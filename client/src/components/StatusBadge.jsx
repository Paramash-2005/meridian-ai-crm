import { LEAD_STATUS_COLORS } from '../utils/colors';

export default function StatusBadge({ status }) {
  return <span className="badge" style={{ color: LEAD_STATUS_COLORS[status] || '#6B6B6B' }}>{status}</span>;
}
