import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);
// '' is a valid value (same-origin, behind a reverse proxy) — only fall back when the var is unset entirely.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      return;
    }
    const s = io(SOCKET_URL || undefined, { auth: { token } });
    setSocket(s);
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

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
