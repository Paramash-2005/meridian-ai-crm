import { useSocket } from '../context/SocketContext';

export default function ToastStack() {
  const { toasts, dismissToast } = useSocket();

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className="bg-navy text-paper border-l-[3px] border-accent rounded-[3px] px-4 py-3 text-[12.5px] cursor-pointer"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
