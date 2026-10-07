const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// Any authenticated user can see the team roster (needed for "assign to" pickers).
router.get('/', async (req, res) => {
  const users = await User.find().sort({ name: 1 });
  res.json(users.map((u) => u.toSafeJSON()));
});

router.post('/', requireRole('admin'), async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (role && !['admin', 'sales-rep'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or sales-rep' });
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) return res.status(409).json({ error: 'A user with that email already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email: email.toLowerCase().trim(), passwordHash, role: role || 'sales-rep' });
  res.status(201).json(user.toSafeJSON());
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const { name, role } = req.body || {};
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (name) user.name = name;
  if (role && ['admin', 'sales-rep'].includes(role)) user.role = role;
  await user.save();

  res.json(user.toSafeJSON());
});

module.exports = router;
