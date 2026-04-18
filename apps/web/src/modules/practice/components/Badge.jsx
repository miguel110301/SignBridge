export default function Badge({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border border-white/10 bg-zinc-800/80 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-zinc-300 ${className}`}
    >
      {children}
    </span>
  )
}
