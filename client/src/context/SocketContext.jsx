import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './useAuth';
import { SocketContext } from './useSocket';

// '' is a valid value (same-origin, behind a reverse proxy) — only fall back when the var is unset entirely.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [connection, setConnection] = useState(null);
  // Logging out disconnects via the effect cleanup; hide the stale socket until the next login.
  const socket = token ? connection : null;
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (!token) return;
    // Same-origin ('' URL) means we're behind the Vercel proxy, which can't upgrade to WebSocket —
    // use long-polling only there instead of failing the upgrade and logging console errors.
    const s = io(SOCKET_URL || undefined, { auth: { token }, transports: SOCKET_URL ? undefined : ['polling'] });
    // Storing the external socket handle is the point of this effect (synchronizing with Socket.io).
    // oxlint-disable-next-line react/set-state-in-effect
    setConnection(s);
    return () => s.disconnect();
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    const notify = (message) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [{ id, message }, ...prev].slice(0, 5));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
    };

    const onNewLead = (lead) => notify(`New lead: ${lead.name}${lead.company ? ` (${lead.company})` : ''}`);
    const onScored = (lead) => notify(`AI scored "${lead.name}" — ${lead.ai?.score}/100`);

    socket.on('lead:new', onNewLead);
    socket.on('lead:scored', onScored);
    return () => {
      socket.off('lead:new', onNewLead);
      socket.off('lead:scored', onScored);
    };
  }, [socket]);

  function dismissToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return <SocketContext.Provider value={{ socket, toasts, dismissToast }}>{children}</SocketContext.Provider>;
}
