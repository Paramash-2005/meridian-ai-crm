export default function StatTile({ label, value, delta }) {
  const deltaColor = delta ? (delta.direction === 'up' ? 'text-good' : 'text-serious') : null;
  const arrow = delta?.direction === 'up' ? '▲' : '▼';

  return (
    <div className="border border-hairline rounded-[3px] p-5 flex flex-col gap-2.5 bg-surface">
      <span className="eyebrow text-[10px]">{label}</span>
      <span className="mono text-[27px] font-medium">{value}</span>
      {delta && (
        <span className={`text-xs ${deltaColor}`}>
          <span className="text-[9px]">{arrow}</span> {delta.text}
        </span>
      )}
    </div>
  );
}
