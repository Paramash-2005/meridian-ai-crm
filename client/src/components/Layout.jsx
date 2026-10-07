import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SocketProvider } from '../context/SocketContext';
import Sidebar from './Sidebar';
import ToastStack from './ToastStack';

export default function Layout() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;

  return (
    <SocketProvider>
      <div className="flex min-h-screen bg-paper">
        <Sidebar />
        <div className="grow min-w-0">
          <Outlet />
        </div>
        <ToastStack />
      </div>
    </SocketProvider>
  );
}
