const express = require('express');
const Lead = require('../models/Lead');
const { scopeLeadsMatch } = require('../middleware/rbac');

const router = express.Router();

router.get('/summary', async (req, res) => {
  const match = scopeLeadsMatch(req);

  const [totals, byStatus, bySource, monthly, topLeads] = await Promise.all([
    Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          pipelineValue: { $sum: { $cond: [{ $in: ['$status', ['Won', 'Lost']] }, 0, '$value'] } },
          wonValue: { $sum: { $cond: [{ $eq: ['$status', 'Won'] }, '$value', 0] } },
          wonCount: { $sum: { $cond: [{ $eq: ['$status', 'Won'] }, 1, 0] } },
          lostCount: { $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] } },
          avgScore: { $avg: '$ai.score' },
        },
      },
    ]),
    Lead.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: match }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    Lead.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Lead.find({ ...match, 'ai.score': { $ne: null } })
      .sort({ 'ai.score': -1 })
      .limit(5)
      .populate('assignedTo', 'name')
      .select('name company ai status value assignedTo')
      .lean(),
  ]);

  const t = totals[0] || { totalLeads: 0, pipelineValue: 0, wonValue: 0, wonCount: 0, lostCount: 0, avgScore: null };
  const decided = t.wonCount + t.lostCount;

  res.json({
    totalLeads: t.totalLeads,
    pipelineValue: t.pipelineValue,
    wonValue: t.wonValue,
    winRate: decided ? (t.wonCount / decided) * 100 : null,
    avgScore: t.avgScore,
    leadsByStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
    leadsBySource: bySource.map((r) => ({ source: r._id, count: r.count })),
    leadsByMonth: monthly.map((r) => ({ month: r._id, count: r.count })),
    topLeads,
  });
});

module.exports = router;
