export default function ShinyButton({ children, className = '', onClick, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`group relative inline-flex items-center justify-center overflow-hidden rounded-full border border-brand-500/50 bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-600 active:scale-[0.99] ${className}`}
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <span className="relative">{children}</span>
    </button>
  )
}
