import LessonNode from './LessonNode.jsx'
import { useI18n } from '../../../i18n/I18nProvider.jsx'

/**
 * A unit section that shows the unit header and its lesson nodes in a
 * winding path (Duolingo-style zigzag).
 */
export default function UnitCard({ unit, unitIndex, onStartLesson }) {
  const { t } = useI18n()
  const { id, lessons, progress: unitProgress } = unit
  const title = t(`academy.units.${id}.title`)
  const desc  = t(`academy.units.${id}.desc`)

  /* colour per unit index to alternate brand/accent/tertiary */
  const accentMap = ['brand', 'accent', 'tertiary']
  const accent = accentMap[unitIndex % accentMap.length]

  const bgGradients = {
    brand:    'from-brand-600 to-brand-700',
    accent:   'from-accent-600 to-accent-700',
    tertiary: 'from-tertiary-700 to-tertiary-800',
  }

  return (
    <section className="w-full">
      {/* Unit header banner */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${bgGradients[accent]} p-5 sm:p-6 text-white shadow-lg mb-8`}>
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
            {t('academy.level')} {unitIndex + 1}
          </p>
          <h2 className="mt-1 text-xl sm:text-2xl font-extrabold">{title}</h2>
          <p className="mt-1 text-sm opacity-80 max-w-md">{desc}</p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
        <div className="absolute -right-2 bottom-0 h-16 w-16 rounded-full bg-white/5" />

        {/* Unit progress bar */}
        <div className="relative z-10 mt-4 h-2 w-full rounded-full bg-white/20">
          <div
            className="h-2 rounded-full bg-white transition-all duration-700"
            style={{ width: `${unitProgress}%` }}
          />
        </div>
        <p className="relative z-10 mt-1 text-xs font-medium opacity-70">{Math.round(unitProgress)}%</p>
      </div>

      {/* Lesson path – zigzag layout */}
      <div className="flex flex-col items-center gap-6">
        {lessons.map((lesson, i) => {
          /* Zigzag offset: alternates left, center, right */
          const offsets = ['translate-x-0', '-translate-x-12 sm:-translate-x-16', 'translate-x-12 sm:translate-x-16']
          const offset = offsets[i % 3]

          return (
            <div key={lesson.id} className={`transform transition-all duration-300 ${offset}`}>
              <LessonNode
                index={i + 1}
                label={lesson.label}
                state={lesson.state}
                progress={lesson.progress}
                onClick={() => onStartLesson(unit.id, lesson.id)}
              />
              {/* Connector line except after last */}
              {i < lessons.length - 1 && (
                <div className="mx-auto mt-2 h-6 w-0.5 bg-zinc-200 dark:bg-zinc-700" />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
