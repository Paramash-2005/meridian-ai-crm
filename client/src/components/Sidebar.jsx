import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ICONS = {
  dashboard: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="6" height="6" /><rect x="10" y="2" width="6" height="6" />
      <rect x="2" y="10" width="6" height="6" /><rect x="10" y="10" width="6" height="6" />
    </svg>
  ),
  leads: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="5.5" r="2.5" /><path d="M2 15c0-2.8 2-4.5 4.5-4.5S11 12.2 11 15" />
      <circle cx="13" cy="6" r="2" /><path d="M12 10.7c2 .2 3.5 1.8 3.5 4.3" />
    </svg>
  ),
  team: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="6" r="3" /><path d="M3 16c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/leads', label: 'Leads', icon: 'leads' },
  { to: '/team', label: 'Team', icon: 'team', adminOnly: true },
];

export default function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const initials = (user?.name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="w-60 shrink-0 min-h-screen box-border bg-navy text-[#C7CCD4] flex flex-col p-6 px-4">
      <div className="flex items-center gap-3 px-2 pb-6 mb-5 border-b border-white/12">
        <div className="w-[34px] h-[34px] shrink-0 border border-accent flex items-center justify-center font-serif text-lg text-accent">M</div>
        <div className="flex flex-col leading-tight">
          <span className="font-serif text-base font-semibold text-paper">Meridian</span>
          <span className="text-[9.5px] tracking-[0.14em] uppercase text-[#7C8592]">AI CRM</span>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 py-2.5 px-3 pl-2.5 text-[13px] font-medium border-l-[3px] ${
                isActive ? 'border-accent bg-white/7 text-paper' : 'border-transparent text-[#C7CCD4]'
              }`
            }
          >
            {ICONS[item.icon]}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex-grow" />

      <div className="border-t border-white/12 pt-4 px-2 pb-1 flex items-center gap-2.5">
        <div className="w-[30px] h-[30px] rounded-full bg-accent text-navy shrink-0 flex items-center justify-center font-serif text-xs font-semibold">
          {initials}
        </div>
        <div className="flex flex-col leading-tight min-w-0 flex-grow">
          <span className="text-xs text-paper font-medium truncate">{user?.name}</span>
          <span className="text-[10.5px] text-[#7C8592] capitalize">{user?.role?.replace('-', ' ')}</span>
        </div>
        <button onClick={logout} title="Sign out" className="text-[#7C8592] hover:text-paper text-[11px] shrink-0 cursor-pointer">
          Sign out
        </button>
      </div>
    </div>
  );
}
