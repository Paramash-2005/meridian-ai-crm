export const LEAD_STATUS_COLORS = {
  New: '#6B6B6B',
  Contacted: '#1B2430',
  Qualified: '#1E7FA8',
  Proposal: '#96631E',
  Negotiation: '#96631E',
  Won: '#2F7A4A',
  Lost: '#8B2635',
};

export const SENTIMENT_COLORS = {
  positive: '#2F7A4A',
  neutral: '#6B6B6B',
  negative: '#8B2635',
};

export default function StatusBadge({ status }) {
  return <span className="badge" style={{ color: LEAD_STATUS_COLORS[status] || '#6B6B6B' }}>{status}</span>;
}
