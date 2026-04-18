import ProgressRing from './ProgressRing.jsx'
import { useI18n } from '../../../i18n/I18nProvider.jsx'

const stateStyles = {
  completed:   'bg-accent-500 text-white shadow-lg shadow-accent-500/30 scale-100',
  current:     'bg-brand-600 text-white shadow-lg shadow-brand-600/40 scale-110 ring-4 ring-brand-300 dark:ring-brand-800',
  available:   'bg-white dark:bg-zinc-800 text-brand-600 dark:text-brand-400 border-2 border-brand-300 dark:border-brand-700',
  locked:      'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-60',
}

const icons = {
  completed: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  locked: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
}

/**
 * A single lesson node on the learning path.
 * state: 'completed' | 'current' | 'available' | 'locked'
 */
export default function LessonNode({ index, label, state = 'locked', progress = 0, onClick }) {
  const { t } = useI18n()
  const isClickable = state !== 'locked'

  const inner = state === 'completed' ? icons.completed
    : state === 'locked' ? icons.locked
    : <span className="text-sm font-bold">{index}</span>

  const tooltipText = state === 'locked' ? t('academy.locked')
    : state === 'completed' ? t('academy.completed')
    : label

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={isClickable ? onClick : undefined}
        disabled={!isClickable}
        title={tooltipText}
        className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${stateStyles[state]}`}
      >
        {(state === 'current' || state === 'available') && progress > 0 ? (
          <ProgressRing radius={32} stroke={4} progress={progress}>
            {inner}
          </ProgressRing>
        ) : inner}

        {/* Pulse ring for current */}
        {state === 'current' && (
          <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/20" />
        )}
      </button>
      {label && state !== 'locked' && (
        <span className="mt-1 max-w-[80px] text-center text-[11px] font-medium text-zinc-600 dark:text-zinc-400 leading-tight">
          {label}
        </span>
      )}
    </div>
  )
}
