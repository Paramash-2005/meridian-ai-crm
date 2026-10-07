function initialsOf(name = '') {
  return name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function Avatar({ name, size = 30, className = '' }) {
  return (
    <div
      className={`shrink-0 rounded-full bg-navy text-paper flex items-center justify-center font-serif font-semibold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initialsOf(name)}
    </div>
  );
}
