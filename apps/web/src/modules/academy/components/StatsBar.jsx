import { useI18n } from '../../../i18n/I18nProvider.jsx'

/** Top stats bar: streak, XP, hearts, level */
export default function StatsBar({ streak = 0, xp = 0, hearts = 5, level = 'beginner' }) {
  const { t } = useI18n()

  const levelLabel = t(`academy.${level}`)

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
      {/* Streak */}
      <div className="flex items-center gap-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2 shadow-sm">
        <span className="text-2xl">🔥</span>
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('academy.streak')}</span>
          <span className="text-lg font-bold text-zinc-900 dark:text-white">{streak}</span>
        </div>
      </div>

      {/* XP */}
      <div className="flex items-center gap-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2 shadow-sm">
        <span className="text-2xl">⭐</span>
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('academy.xp_total')}</span>
          <span className="text-lg font-bold text-brand-600 dark:text-brand-400">{xp}</span>
        </div>
      </div>

      {/* Hearts */}
      <div className="flex items-center gap-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2 shadow-sm">
        <span className="text-2xl">❤️</span>
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('academy.hearts')}</span>
          <span className="text-lg font-bold text-red-500">{hearts}</span>
        </div>
      </div>

      {/* Level */}
      <div className="flex items-center gap-2 rounded-2xl bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 px-4 py-2 shadow-sm">
        <span className="text-2xl">🎓</span>
        <div className="flex flex-col">
          <span className="text-xs text-brand-600 dark:text-brand-300">{t('academy.level')}</span>
          <span className="text-lg font-bold text-brand-700 dark:text-brand-300">{levelLabel}</span>
        </div>
      </div>
    </div>
  )
}
