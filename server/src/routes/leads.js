const express = require('express');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { requireRole, scopeLeadsQuery } = require('../middleware/rbac');
const { aiQueue } = require('../queues/aiQueue');
const { publishEvent } = require('../socket/publish');
const ai = require('../services/ai');

const router = express.Router();

const STATUSES = Lead.schema.path('status').enumValues;
const SOURCES = Lead.schema.path('source').enumValues;

const isValidId = (id) => mongoose.isValidObjectId(id) && String(id).length === 24;
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asString = (v) => (typeof v === 'string' ? v : undefined);

// Reject malformed ids up front so they return 404 instead of a Mongoose CastError (500).
router.param('id', (req, res, next, id) => {
  if (!isValidId(id)) return res.status(404).json({ error: 'Lead not found' });
  next();
});

// Returns an error message, or null when the editable fields are acceptable.
async function validateLeadFields({ status, source, value, assignedTo }) {
  if (status !== undefined && !STATUSES.includes(status)) return `status must be one of: ${STATUSES.join(', ')}`;
  if (source !== undefined && !SOURCES.includes(source)) return `source must be one of: ${SOURCES.join(', ')}`;
  if (value !== undefined && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
    return 'value must be a non-negative number';
  }
  if (assignedTo) {
    if (!isValidId(assignedTo) || !(await User.exists({ _id: assignedTo }))) return 'assignedTo must be an existing user';
  }
  return null;
}

function canAccessLead(req, lead) {
  if (req.user.role === 'admin') return true;
  return !lead.assignedTo || String(lead.assignedTo) === String(req.user.sub);
}

router.get('/', async (req, res) => {
  const query = scopeLeadsQuery(req);
  const status = asString(req.query.status);
  const assignedTo = asString(req.query.assignedTo);
  const search = asString(req.query.search)?.trim();

  if (status) {
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status filter' });
    query.status = status;
  }
  if (assignedTo) {
    if (!isValidId(assignedTo)) return res.status(400).json({ error: 'Invalid assignedTo filter' });
    query.assignedTo = assignedTo;
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    query.$and = [...(query.$and || []), { $or: [{ name: pattern }, { company: pattern }] }];
  }

  const leads = await Lead.find(query).populate('assignedTo', 'name email role').sort({ createdAt: -1 }).lean();
  res.json(leads);
});

router.get('/:id', async (req, res) => {
  const lead = await Lead.findById(req.params.id)
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email')
    .populate('notes.author', 'name');
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canAccessLead(req, lead)) return res.status(403).json({ error: 'You do not have access to this lead' });

  res.json(lead);
});

router.post('/', async (req, res) => {
  const { name, email, phone, company, source, value, assignedTo } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const invalid = await validateLeadFields({ source, value, assignedTo: req.user.role === 'admin' ? assignedTo : null });
  if (invalid) return res.status(400).json({ error: invalid });

  const lead = await Lead.create({
    name,
    email,
    phone,
    company,
    source,
    value: Number(value) || 0,
    assignedTo: req.user.role === 'admin' ? assignedTo || null : req.user.sub,
    createdBy: req.user.sub,
    activities: [{ type: 'created', message: `Lead created by ${req.user.name}` }],
  });

  await aiQueue.add('score', { leadId: lead.id });

  const populated = await lead.populate('assignedTo', 'name email role');
  publishEvent('lead:new', populated.toJSON(), ['role:admin', lead.assignedTo ? `user:${lead.assignedTo}` : null].filter(Boolean));

  res.status(201).json(populated);
});

router.put('/:id', async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canAccessLead(req, lead)) return res.status(403).json({ error: 'You do not have access to this lead' });

  const { name, email, phone, company, source, status, value, assignedTo } = req.body || {};
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }
  const invalid = await validateLeadFields({ status, source, value, assignedTo: req.user.role === 'admin' ? assignedTo : null });
  if (invalid) return res.status(400).json({ error: invalid });

  const statusChanged = status && status !== lead.status;

  if (name) lead.name = name;
  if (email !== undefined) lead.email = email;
  if (phone !== undefined) lead.phone = phone;
  if (company !== undefined) lead.company = company;
  if (source) lead.source = source;
  if (value !== undefined) lead.value = Number(value) || 0;
  if (status) lead.status = status;
  if (assignedTo !== undefined && req.user.role === 'admin') lead.assignedTo = assignedTo || null;

  if (statusChanged) {
    lead.activities.push({ type: 'status-change', message: `Status changed to ${status} by ${req.user.name}` });
  }

  await lead.save();
  const populated = await lead.populate('assignedTo', 'name email role');
  publishEvent('lead:updated', populated.toJSON(), ['role:admin', lead.assignedTo ? `user:${lead.assignedTo}` : null].filter(Boolean));

  res.json(populated);
});

router.post('/:id/notes', async (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'Note text is required' });

  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canAccessLead(req, lead)) return res.status(403).json({ error: 'You do not have access to this lead' });

  lead.notes.push({ text: text.trim(), author: req.user.sub });
  await lead.save();
  const note = lead.notes[lead.notes.length - 1];

  await aiQueue.add('sentiment', { leadId: lead.id, noteId: note.id });

  res.status(201).json(note);
});

router.post('/:id/auto-reply', async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canAccessLead(req, lead)) return res.status(403).json({ error: 'You do not have access to this lead' });

  const { reply, mock } = await ai.generateAutoReply(lead);
  res.json({ reply, mock });
});

router.post('/:id/rescore', requireRole('admin'), async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  lead.ai.status = 'pending';
  await lead.save();
  await aiQueue.add('score', { leadId: lead.id });

  res.json({ queued: true });
});

module.exports = router;
