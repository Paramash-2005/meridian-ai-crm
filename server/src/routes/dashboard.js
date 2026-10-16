const express = require('express');
const Lead = require('../models/Lead');
const { scopeLeadsMatch } = require('../middleware/rbac');

const router = express.Router();

const TREND_MONTHS = 4;

// The trend chart is labelled "Last 4 months": return exactly those calendar months (UTC, matching
// $dateToString's default), oldest first, so empty months show as 0 instead of vanishing.
function trendWindow() {
  const now = new Date();
  const keys = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (TREND_MONTHS - 1), 1));
  return { keys, start };
}

router.get('/summary', async (req, res) => {
  const match = scopeLeadsMatch(req);
  const trend = trendWindow();

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
      { $match: { ...match, createdAt: { $gte: trend.start } } },
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
    leadsByMonth: trend.keys.map((month) => ({ month, count: monthly.find((r) => r._id === month)?.count || 0 })),
    topLeads,
  });
});

module.exports = router;
