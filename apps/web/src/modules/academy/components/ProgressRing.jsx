/** Circular SVG progress ring used for lesson nodes */
export default function ProgressRing({ radius = 32, stroke = 4, progress = 0, children, className = '' }) {
  const normalised = Math.min(Math.max(progress, 0), 100)
  const normalRadius = radius - stroke / 2
  const circumference = 2 * Math.PI * normalRadius

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={radius * 2} height={radius * 2} className="-rotate-90">
        {/* Track */}
        <circle
          cx={radius}
          cy={radius}
          r={normalRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-zinc-200 dark:text-zinc-700"
        />
        {/* Progress */}
        <circle
          cx={radius}
          cy={radius}
          r={normalRadius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (normalised / 100) * circumference}
          className="text-brand-500 transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
