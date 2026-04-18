import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nProvider.jsx'

export default function LessonComplete() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { state } = useLocation()
  const { unitId } = useParams()

  const score   = state?.score ?? 0
  const xp      = state?.xp ?? 0
  const total   = state?.total ?? 0
  const correct = state?.correct ?? 0

  const messageKey = score === 100 ? 'perfect'
    : score >= 80 ? 'great'
    : score >= 50 ? 'good'
    : 'keep_practicing'

  const emoji = score === 100 ? '🏆' : score >= 80 ? '🎉' : score >= 50 ? '👍' : '💪'

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-12 sm:py-20 text-center min-h-[70vh]">
      {/* Big emoji */}
      <span className="text-7xl mb-4">{emoji}</span>

      {/* Title */}
      <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white">
        {t('academy.lesson_complete')}
      </h1>
      <p className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
        {t(`academy.results.${messageKey}`)}
      </p>

      {/* Stats cards */}
      <div className="mt-8 grid w-full grid-cols-2 gap-4">
        {/* Accuracy */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('academy.results.accuracy')}</p>
          <p className="mt-1 text-2xl font-bold text-brand-600 dark:text-brand-400">{score}%</p>
        </div>

        {/* XP earned */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('academy.xp')}</p>
          <p className="mt-1 text-2xl font-bold text-accent-600 dark:text-accent-400">+{xp}</p>
        </div>

        {/* Correct answers */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('academy.results.new_signs')}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{correct}/{total}</p>
        </div>

        {/* Score ring */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center justify-center">
          <div className="relative h-16 w-16">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" strokeWidth="6"
                className="stroke-zinc-200 dark:stroke-zinc-700" />
              <circle cx="32" cy="32" r="28" fill="none" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 28}
                strokeDashoffset={2 * Math.PI * 28 * (1 - score / 100)}
                className={score >= 80 ? 'stroke-accent-500' : score >= 50 ? 'stroke-brand-500' : 'stroke-tertiary-500'}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-zinc-700 dark:text-zinc-200">
              {score}%
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => navigate('/academia')}
          className="btn-primary flex-1"
        >
          {t('academy.results.back_to_academy')}
        </button>
        {score < 100 && (
          <button
            type="button"
            onClick={() => navigate(`/academia/leccion/${unitId}/${state?.lessonId || 'lesson-1'}`, { replace: true })}
            className="btn-outlined flex-1"
          >
            {t('academy.try_again')}
          </button>
        )}
      </div>
    </div>
  )
}
