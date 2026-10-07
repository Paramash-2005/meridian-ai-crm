import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import Avatar from '../components/Avatar';

function NewUserModal({ onClose, onCreated, token }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'sales-rep' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await api.createUser(form, token);
      onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-navy/35 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="w-96 bg-surface rounded-[3px] p-7 flex flex-col gap-4">
        <h2 className="text-xl">New Team Member</h2>
        {[
          { label: 'Full name', key: 'name', type: 'text' },
          { label: 'Email', key: 'email', type: 'email' },
          { label: 'Temporary password', key: 'password', type: 'text' },
        ].map(({ label, key, type }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <label htmlFor={`new-user-${key}`} className="text-xs font-medium">{label}</label>
            <input
              id={`new-user-${key}`}
              type={type}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="box-border w-full px-2.5 py-2 text-[13px] border border-hairline rounded-[3px]"
            />
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-user-role" className="text-xs font-medium">Role</label>
          <select id="new-user-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="px-2.5 py-2 text-[13px] border border-hairline rounded-[3px]">
            <option value="sales-rep">Sales Rep</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && <p className="m-0 text-[12.5px] text-critical">{error}</p>}
        <div className="flex gap-2.5 justify-end mt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-[12.5px] font-medium border border-hairline rounded-[3px] cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-[12.5px] font-semibold bg-accent text-paper rounded-[3px] cursor-pointer disabled:opacity-60">
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Team() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');

  function loadUsers() {
    api.getUsers(token).then(setUsers).catch((err) => setError(err.message));
  }

  useEffect(() => { loadUsers(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="px-8 pt-[26px] pb-[18px] flex justify-between items-start border-b border-hairline">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Workspace / Team</span>
          <h1 className="text-[26px]">Team</h1>
        </div>
        <button className="px-4 py-2.5 text-[12.5px] font-semibold bg-accent text-paper rounded-[3px] cursor-pointer" onClick={() => setShowModal(true)}>+ New Team Member</button>
      </div>

      {error && <div className="px-8 py-2.5 text-critical text-sm">{error}</div>}

      <div className="px-8 py-6 grid grid-cols-3 gap-5">
        {users.map((u) => (
          <div key={u.id} className="border border-hairline rounded-[3px] p-5 flex items-center gap-3.5 bg-surface">
            <Avatar name={u.name} size={44} />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-sm">{u.name}</span>
              <span className="text-xs text-ink-secondary">{u.email}</span>
              <span className="badge mt-1 self-start" style={{ color: u.role === 'admin' ? 'var(--color-accent)' : 'var(--color-navy)' }}>
                {u.role === 'admin' ? 'Admin' : 'Sales Rep'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <NewUserModal token={token} onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); loadUsers(); }} />
      )}
    </div>
  );
}
