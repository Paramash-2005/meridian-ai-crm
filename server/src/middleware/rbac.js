const mongoose = require('mongoose');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }
    next();
  };
}

// Sales reps only ever see leads assigned to them (or unassigned); admins see everything.
function scopeLeadsQuery(req) {
  if (req.user.role === 'admin') return {};
  return { $or: [{ assignedTo: req.user.sub }, { assignedTo: null }] };
}

// Same scoping rule, but with a real ObjectId so it also works inside aggregation pipelines.
function scopeLeadsMatch(req) {
  if (req.user.role === 'admin') return {};
  const userId = new mongoose.Types.ObjectId(req.user.sub);
  return { $or: [{ assignedTo: userId }, { assignedTo: null }] };
}

module.exports = { requireRole, scopeLeadsQuery, scopeLeadsMatch };
