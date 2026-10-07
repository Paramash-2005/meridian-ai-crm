import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import StatTile from '../components/StatTile';
import { LEAD_STATUS_COLORS } from '../components/StatusBadge';
import { money } from '../utils/format';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym) => MONTH_LABELS[Number(ym.slice(5, 7)) - 1];
const STATUS_ORDER = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-hairline rounded-[3px] px-3 py-2 text-xs">
      <div className="text-ink-secondary mb-0.5">{label}</div>
      <div className="mono font-semibold">{payload[0].value} new leads</div>
    </div>
  );
}

export default function Dashboard() {
  const { token, isAdmin } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboardSummary(token).then(setSummary).catch((err) => setError(err.message));
  }, [token]);

  const chartData = useMemo(
    () => (summary?.leadsByMonth || []).map((r) => ({ month: monthLabel(r.month), count: r.count })),
    [summary]
  );

  const statusRows = useMemo(() => {
    if (!summary?.leadsByStatus) return [];
    const map = Object.fromEntries(summary.leadsByStatus.map((s) => [s.status, s.count]));
    const max = Math.max(1, ...Object.values(map));
    return STATUS_ORDER.map((status) => ({
      status,
      count: map[status] || 0,
      pct: ((map[status] || 0) / max) * 100,
      color: LEAD_STATUS_COLORS[status],
    }));
  }, [summary]);

  if (error) return <div className="p-8">{error}</div>;
  if (!summary) return <div className="p-8 text-ink-secondary">Loading…</div>;

  return (
    <div>
      <div className="px-8 pt-[26px] pb-[18px] flex justify-between items-start border-b border-hairline">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Workspace / Dashboard</span>
          <h1 className="text-[26px]">{isAdmin ? 'Company Dashboard' : 'My Dashboard'}</h1>
        </div>
      </div>

      <div className="px-8 pt-6 grid grid-cols-4 gap-5">
        <StatTile label="Total Leads" value={summary.totalLeads} />
        <StatTile label="Pipeline Value" value={money(summary.pipelineValue)} />
        <StatTile label="Win Rate" value={summary.winRate != null ? `${summary.winRate.toFixed(1)}%` : '—'} />
        <StatTile label="Avg AI Score" value={summary.avgScore != null ? summary.avgScore.toFixed(0) : '—'} />
      </div>

      <div className="px-8 pt-5 grid grid-cols-[1.35fr_1fr] gap-5">
        <div className="border border-hairline rounded-[3px] p-6 bg-surface">
          <div className="mb-3.5">
            <h3 className="text-[15px]">New Leads Over Time</h3>
            <span className="text-[11.5px] text-ink-secondary">Last 4 months</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-ink-secondary)' }} axisLine={{ stroke: 'var(--color-hairline)' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 9.5, fill: 'var(--color-ink-faint)' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="count" stroke="var(--color-chart-1)" strokeWidth={2} fill="var(--color-chart-1)" fillOpacity={0.08} dot={{ r: 2.5, fill: 'var(--color-chart-1)', strokeWidth: 0 }} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-hairline rounded-[3px] p-6 bg-surface">
          <div className="mb-5">
            <h3 className="text-[15px]">Leads by Status</h3>
            <span className="text-[11.5px] text-ink-secondary">All time</span>
          </div>
          {statusRows.map((row) => (
            <div key={row.status} className="flex items-center gap-3 mb-4">
              <span className="w-24 shrink-0 text-[11.5px] text-right">{row.status}</span>
              <div className="grow h-3.5 bg-[#F0EEE9] rounded-sm overflow-hidden">
                <div className="h-full rounded-sm" style={{ width: `${row.pct}%`, background: row.color }} />
              </div>
              <span className="mono w-7 shrink-0 text-right text-[11.5px]">{row.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 py-5">
        <div className="border border-hairline rounded-[3px] bg-surface">
          <div className="px-[22px] py-[18px] border-b border-hairline">
            <h3 className="text-[15px]">Hottest Leads (AI Score)</h3>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-hairline">
                {['Lead', 'Company', 'Owner', 'Score', 'Value'].map((h, i) => (
                  <th key={h} className={`px-[22px] py-2.5 text-[10px] tracking-[0.08em] uppercase text-ink-secondary ${i >= 3 ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.topLeads.map((l, i) => (
                <tr key={l._id} className={`border-b border-[#EDEBE5] ${i % 2 === 0 ? 'bg-surface' : 'bg-paper-alt'}`}>
                  <td className="px-[22px] py-2.5 font-medium">{l.name}</td>
                  <td className="px-[22px] py-2.5 text-ink-secondary">{l.company || '—'}</td>
                  <td className="px-[22px] py-2.5 text-ink-secondary">{l.assignedTo?.name || 'Unassigned'}</td>
                  <td className="px-[22px] py-2.5 text-right">
                    <span className="mono inline-flex items-center justify-center w-7 h-7 rounded-full border-[1.5px]" style={{ borderColor: l.ai.score >= 80 ? 'var(--color-accent)' : 'var(--color-navy)', color: l.ai.score >= 80 ? 'var(--color-accent)' : 'var(--color-navy)' }}>
                      {l.ai.score}
                    </span>
                  </td>
                  <td className="px-[22px] py-2.5 text-right mono font-medium">{money(l.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
