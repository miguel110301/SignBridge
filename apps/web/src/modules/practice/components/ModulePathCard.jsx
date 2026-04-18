import { useNavigate } from 'react-router-dom'

export default function ModulePathCard({
  moduleItem,
  isActive,
  isLast,
  onSelect,
  detailPath = null,
}) {
  const navigate = useNavigate()

  function handleTitleClick(event) {
    if (!detailPath) return

    event.stopPropagation()
    onSelect(moduleItem.id)
    navigate(detailPath)
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(moduleItem.id)}
      className="group relative w-full text-left"
    >
      {!isLast && (
        <span className="absolute left-[18px] top-11 h-[calc(100%+1.7rem)] w-px bg-[#141c30]" />
      )}

      <div className="flex items-start gap-5">
        <span
          className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center text-sm font-medium ${
            isActive
              ? 'rounded-full border border-[#5b57ff] text-[#7d82ff] shadow-[0_0_0_3px_rgba(91,87,255,0.14)]'
              : 'text-zinc-500'
          }`}
        >
          M{moduleItem.displayOrder}
        </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2">
            <h3
              onClick={detailPath ? handleTitleClick : undefined}
              className={`text-[1.85rem] leading-tight transition-colors ${
                isActive ? 'font-semibold text-white' : 'font-normal text-zinc-300 group-hover:text-zinc-200'
              } ${
                detailPath ? 'cursor-pointer underline-offset-4 hover:underline' : ''
              }`}
            >
              {moduleItem.title}
            </h3>
            {isActive && (
              <span className="pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b67ff]">
                Activo
              </span>
            )}
          </div>

          <p className="mt-2 max-w-[42rem] text-[1.05rem] leading-relaxed text-[#6f7f99]">
            {moduleItem.description}
          </p>

          <div className="mt-3 flex items-center gap-4 text-[0.95rem] text-zinc-500">
            <span>{moduleItem.completionRate}%</span>
            {moduleItem.completionRate > 0 && (
              <span className="h-px w-36 bg-[#13334a]">
                <span
                  className="block h-px bg-cyan-400"
                  style={{ width: `${Math.max(moduleItem.completionRate, 12)}%` }}
                />
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
