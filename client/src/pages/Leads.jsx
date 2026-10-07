import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../api';
import Avatar from '../components/Avatar';
import StatusBadge, { SENTIMENT_COLORS } from '../components/StatusBadge';
import { money, timeAgo, formatDate } from '../utils/format';

const STATUS_OPTIONS = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const SOURCE_OPTIONS = ['Website', 'Referral', 'Cold Call', 'Event', 'Advertising', 'Other'];

function ScoreBadge({ ai }) {
  if (ai?.status === 'pending') {
    return <span className="mono inline-flex items-center justify-center w-7 h-7 rounded-full border-[1.5px] border-ink-faint text-ink-faint text-[10px]">⋯</span>;
  }
  if (ai?.status === 'failed' || ai?.score == null) {
    return <span className="text-ink-faint text-xs">—</span>;
  }
  const hot = ai.score >= 80;
  return (
    <span
      className="mono inline-flex items-center justify-center w-7 h-7 rounded-full border-[1.5px] text-[11px] font-semibold"
      style={{ borderColor: hot ? 'var(--color-accent)' : 'var(--color-navy)', color: hot ? 'var(--color-accent)' : 'var(--color-navy)' }}
      title={ai.rationale}
    >
      {ai.score}
    </span>
  );
}

function NewLeadModal({ onClose, onCreated, token }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', source: 'Website', value: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required.');
    setSaving(true);
    setError('');
    try {
      const created = await api.createLead(form, token);
      onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const field = (label, key, type = 'text') => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`new-lead-${key}`} className="text-xs font-medium">{label}</label>
      <input
        id={`new-lead-${key}`}
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="box-border w-full px-2.5 py-2 text-[13px] border border-hairline rounded-[3px]"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-navy/35 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="w-[440px] bg-surface rounded-[3px] p-7 flex flex-col gap-4 max-h-[85vh] overflow-auto">
        <h2 className="text-xl">New Lead</h2>
        {field('Full name', 'name')}
        {field('Email', 'email', 'email')}
        {field('Phone', 'phone')}
        {field('Company', 'company')}
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <label htmlFor="new-lead-source" className="text-xs font-medium">Source</label>
            <select id="new-lead-source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="px-2.5 py-2 text-[13px] border border-hairline rounded-[3px]">
              {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1">{field('Est. deal value ($)', 'value', 'number')}</div>
        </div>
        {error && <p className="m-0 text-[12.5px] text-critical">{error}</p>}
        <div className="flex gap-2.5 justify-end mt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-[12.5px] font-medium border border-hairline rounded-[3px] cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-[12.5px] font-semibold bg-accent text-paper rounded-[3px] cursor-pointer disabled:opacity-60">
            {saving ? 'Creating…' : 'Create Lead'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Leads() {
  const { token, isAdmin } = useAuth();
  const { socket } = useSocket();
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [autoReply, setAutoReply] = useState(null);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState('');

  const loadLeads = useCallback((preferId) => {
    api.getLeads(token).then((rows) => {
      setLeads(rows);
      if (rows.length && !rows.some((r) => r._id === (preferId ?? selectedId))) {
        setSelectedId(rows[0]._id);
      } else if (preferId) {
        setSelectedId(preferId);
      } else if (!selectedId && rows.length) {
        setSelectedId(rows[0]._id);
      }
    }).catch((err) => setError(err.message));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => { api.getUsers(token).then(setUsers).catch(() => {}); }, [token]);

  useEffect(() => {
    if (selectedId == null) return;
    api.getLead(selectedId, token).then(setDetail).catch((err) => setError(err.message));
  }, [selectedId, token]);

  useEffect(() => {
    if (!socket) return;
    const refreshIfRelevant = () => { loadLeads(); if (selectedId) api.getLead(selectedId, token).then(setDetail).catch(() => {}); };
    socket.on('lead:new', refreshIfRelevant);
    socket.on('lead:scored', refreshIfRelevant);
    socket.on('lead:updated', refreshIfRelevant);
    socket.on('lead:note-scored', refreshIfRelevant);
    return () => {
      socket.off('lead:new', refreshIfRelevant);
      socket.off('lead:scored', refreshIfRelevant);
      socket.off('lead:updated', refreshIfRelevant);
      socket.off('lead:note-scored', refreshIfRelevant);
    };
  }, [socket, loadLeads, selectedId, token]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchesSearch = !search || `${l.name} ${l.company || ''}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  async function handleFieldChange(patch) {
    const updated = await api.updateLead(detail._id, patch, token);
    setDetail({ ...detail, ...updated });
    loadLeads(detail._id);
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    const note = await api.addNote(detail._id, noteText, token);
    setDetail({ ...detail, notes: [...detail.notes, note] });
    setNoteText('');
  }

  async function handleGenerateReply() {
    setReplying(true);
    setAutoReply(null);
    try {
      const result = await api.generateAutoReply(detail._id, token);
      setAutoReply(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setReplying(false);
    }
  }

  return (
    <div>
      <div className="px-8 pt-[26px] pb-[18px] flex justify-between items-start border-b border-hairline">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Workspace / Leads</span>
          <h1 className="text-[26px]">Leads</h1>
        </div>
        <button className="px-4 py-2.5 text-[12.5px] font-semibold bg-accent text-paper rounded-[3px] cursor-pointer" onClick={() => setShowModal(true)}>+ New Lead</button>
      </div>

      <div className="px-8 py-3.5 flex items-center gap-2.5 border-b border-hairline">
        <input
          type="text"
          aria-label="Search leads by name or company"
          placeholder="Search leads by name or company"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="box-border w-64 px-3 py-2 text-[12.5px] border border-hairline rounded-[3px]"
        />
        <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2.5 py-1.5 text-xs border border-hairline rounded-[3px] bg-transparent">
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div className="px-8 py-2.5 text-critical text-sm">{error}</div>}

      <div className="flex">
        <div className="grow min-w-0 box-border pt-3.5 pl-8">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b-[1.5px] border-navy">
                {['Lead', 'Status', 'Owner', 'Value', 'Created', 'AI Score'].map((h, i) => (
                  <th key={h} className={`px-2.5 py-2 text-[10px] tracking-[0.08em] uppercase text-ink-secondary ${i >= 3 ? 'text-right' : 'text-left'} ${i === 5 ? 'text-center' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => (
                <tr
                  key={l._id}
                  onClick={() => setSelectedId(l._id)}
                  className="border-b border-[#EDEBE5] cursor-pointer"
                  style={{ background: l._id === selectedId ? 'rgba(168,134,60,0.07)' : i % 2 === 0 ? '#FFFFFF' : 'var(--color-paper-alt)' }}
                >
                  <td className="px-2.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={l.name} size={30} />
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold">{l.name}</span>
                        <span className="text-[11px] text-ink-secondary">{l.company || '—'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5"><StatusBadge status={l.status} /></td>
                  <td className="px-2.5 py-2.5 text-ink-secondary">{l.assignedTo?.name || 'Unassigned'}</td>
                  <td className="mono px-2.5 py-2.5 text-right font-medium">{money(l.value)}</td>
                  <td className="px-2.5 py-2.5 text-right text-ink-secondary">{timeAgo(l.createdAt)}</td>
                  <td className="px-2.5 py-2.5 text-center"><ScoreBadge ai={l.ai} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {detail && (
          <div className="w-[400px] shrink-0 box-border border-l border-hairline bg-surface p-7 flex flex-col gap-[22px] overflow-auto">
            <div className="flex gap-3.5 items-start">
              <Avatar name={detail.name} size={54} className="text-accent" />
              <div className="flex flex-col gap-1 pt-0.5">
                <h2 className="text-[19px]">{detail.name}</h2>
                <span className="text-xs text-ink-secondary">{detail.company || 'No company on file'}</span>
              </div>
            </div>

            <div className="h-px bg-hairline" />

            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="eyebrow text-[9.5px]">Deal Value</span>
                <span className="mono text-lg font-medium">{money(detail.value)}</span>
              </div>
              <div className="flex flex-col gap-1 items-center">
                <span className="eyebrow text-[9.5px]">AI Score</span>
                <ScoreBadge ai={detail.ai} />
              </div>
              <div className="flex flex-col gap-1 items-end">
                <span className="eyebrow text-[9.5px]">Status</span>
                <select
                  aria-label="Lead status"
                  value={detail.status}
                  onChange={(e) => handleFieldChange({ status: e.target.value })}
                  className="border rounded-[3px] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] font-semibold bg-transparent"
                  style={{ borderColor: 'currentColor' }}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {detail.ai?.rationale && (
              <div className="border border-hairline rounded-[3px] p-3 text-[12px] text-ink-secondary italic">{detail.ai.rationale}</div>
            )}

            {isAdmin && (
              <div className="flex flex-col gap-1.5">
                <span className="eyebrow text-[10.5px] font-semibold">Assigned To</span>
                <select
                  value={detail.assignedTo?._id || detail.assignedTo || ''}
                  onChange={(e) => handleFieldChange({ assignedTo: e.target.value || null })}
                  className="px-2.5 py-1.5 text-xs border border-hairline rounded-[3px]"
                >
                  <option value="">Unassigned</option>
                  {users.filter((u) => u.role === 'sales-rep').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1.5 text-[12.5px]">
              <span className="eyebrow text-[10.5px] font-semibold">Contact</span>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2.5 items-center"><span className="text-accent w-3.5">&#9993;</span><span>{detail.email || 'No email on file'}</span></div>
                <div className="flex gap-2.5 items-center"><span className="text-accent w-3.5">&#9742;</span><span>{detail.phone || 'No phone on file'}</span></div>
                <div className="flex gap-2.5 items-center"><span className="text-accent w-3.5">&#128188;</span><span>{detail.source}</span></div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-[10.5px] font-semibold">AI Auto-Reply</span>
                <button onClick={handleGenerateReply} disabled={replying} className="text-[11px] font-medium text-accent cursor-pointer disabled:opacity-60">
                  {replying ? 'Generating…' : 'Generate draft'}
                </button>
              </div>
              {autoReply && (
                <div className="border border-hairline rounded-[3px] p-3 text-[12px] whitespace-pre-line bg-paper-alt">
                  {autoReply.reply}
                  {autoReply.mock && <div className="mt-2 text-[10px] text-ink-faint uppercase tracking-wide">Mock draft &mdash; add OPENAI_API_KEY for live generation</div>}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="eyebrow text-[10.5px] font-semibold">Notes &amp; Sentiment</span>
              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  aria-label="Add a note"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Log a call or note…"
                  className="grow box-border px-2.5 py-1.5 text-xs border border-hairline rounded-[3px]"
                />
                <button type="submit" className="px-3 py-1.5 text-xs font-medium border border-hairline rounded-[3px] cursor-pointer">Add</button>
              </form>
              <div className="flex flex-col gap-2.5">
                {[...detail.notes].reverse().map((n) => (
                  <div key={n._id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] text-ink-faint">{timeAgo(n.createdAt)}</span>
                      {n.sentiment?.label ? (
                        <span className="badge" style={{ color: SENTIMENT_COLORS[n.sentiment.label] }}>{n.sentiment.label}</span>
                      ) : (
                        <span className="text-[10px] text-ink-faint">analyzing…</span>
                      )}
                    </div>
                    <span className="text-[12.5px]">{n.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="eyebrow text-[10.5px] font-semibold">Activity</span>
              <div className="flex flex-col gap-2.5">
                {[...detail.activities].reverse().slice(0, 6).map((a) => (
                  <div key={a._id} className="flex gap-2.5">
                    <div className="w-[7px] h-[7px] rounded-full bg-navy mt-1.5 shrink-0" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10.5px] text-ink-faint">{formatDate(a.createdAt)}</span>
                      <span className="text-[12.5px]">{a.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewLeadModal
          token={token}
          onClose={() => setShowModal(false)}
          onCreated={(created) => { setShowModal(false); loadLeads(created._id); }}
        />
      )}
    </div>
  );
}
