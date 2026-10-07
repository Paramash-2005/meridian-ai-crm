import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@meridiancrm.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <div className="flex-none w-[42%] min-w-[420px] bg-navy text-paper flex flex-col justify-between p-14">
        <div className="flex items-center gap-3">
          <div className="w-[42px] h-[42px] shrink-0 border border-accent flex items-center justify-center font-serif text-xl text-accent">M</div>
          <div className="flex flex-col leading-tight">
            <span className="font-serif text-xl font-semibold">Meridian</span>
            <span className="text-[10.5px] tracking-[0.16em] uppercase text-[#8b93a0]">AI-Powered CRM</span>
          </div>
        </div>

        <div className="flex flex-col gap-7">
          <div className="w-16 h-px bg-accent" />
          <p className="font-serif italic text-[25px] leading-[1.55] text-[#F1EFE9] max-w-[460px] m-0">
            &ldquo;Every lead scored, every follow-up on time &mdash; judgment, not guesswork, at the speed the pipeline demands.&rdquo;
          </p>
          <span className="text-[11px] tracking-[0.12em] uppercase text-[#8b93a0]">Sales Operations Platform</span>
        </div>

        <div className="flex justify-between items-end text-[11px] text-[#6b7684] tracking-wide">
          <span>&copy; 2026 Meridian CRM</span>
          <span>SOC 2 Type II &middot; ISO 27001</span>
        </div>
      </div>

      <div className="grow flex items-center justify-center">
        <form onSubmit={handleSubmit} className="w-[400px] flex flex-col gap-[26px]">
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] tracking-[0.16em] uppercase text-accent font-semibold">Team Workspace</span>
            <h1 className="text-[30px] font-semibold">Sign in to Meridian</h1>
            <p className="m-0 text-[13.5px] text-ink-secondary leading-relaxed">Enter your credentials to access your pipeline and leads.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="box-border w-full px-3.5 py-2.5 text-[13.5px] border border-hairline rounded-[3px] bg-surface"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Admin@123"
              className="box-border w-full px-3.5 py-2.5 text-[13.5px] border border-hairline rounded-[3px] bg-surface"
            />
          </div>

          {error && <p className="m-0 text-[12.5px] text-critical">{error}</p>}

          <button type="submit" disabled={loading} className="w-full py-3 text-sm font-medium bg-navy text-paper rounded-[3px] cursor-pointer disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="text-[11.5px] text-ink-faint text-center leading-relaxed">
            <p className="m-0">Demo logins:</p>
            <p className="m-0">admin@meridiancrm.com / Admin@123 (admin)</p>
            <p className="m-0">james@meridiancrm.com / Sales@123 (sales rep)</p>
          </div>
        </form>
      </div>
    </div>
  );
}
