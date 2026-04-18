import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nProvider.jsx'
import StatsBar from './components/StatsBar.jsx'
import UnitCard from './components/UnitCard.jsx'
import useAcademyProgress from './useAcademyProgress.js'
import { curriculum } from './academyData.js'

export default function AcademyPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const progress = useAcademyProgress()

  /* Compute the level based on total XP */
  const level = progress.xp >= 500 ? 'advanced' : progress.xp >= 150 ? 'intermediate' : 'beginner'

  /* Build enriched units with lesson states */
  const units = useMemo(() => {
    let prevUnitDone = true

    return curriculum.map((unit, ui) => {
      let completedCount = 0
      let foundCurrent = false
      const unitUnlocked = ui === 0 || prevUnitDone

      const lessons = unit.lessons.map((lesson, li) => {
        const done = progress.isLessonCompleted(unit.id, lesson.id)
        if (done) completedCount++

        const previousLessonId = li > 0 ? unit.lessons[li - 1]?.id : null
        const previousLessonDone =
          li === 0
            ? unitUnlocked
            : progress.isLessonCompleted(unit.id, previousLessonId)

        let state = 'locked'
        if (done) {
          state = 'completed'
        } else if (!foundCurrent && previousLessonDone) {
          state = 'current'
          foundCurrent = true
        } else if (previousLessonDone) {
          state = 'available'
        }

        return {
          ...lesson,
          label: lesson.signs.slice(0, 3).join(', ') + (lesson.signs.length > 3 ? '…' : ''),
          state,
          progress: done ? 100 : progress.getLessonScore(unit.id, lesson.id),
        }
      })

      const unitDone = completedCount === unit.lessons.length
      const unitProgress = unit.lessons.length > 0 ? (completedCount / unit.lessons.length) * 100 : 0

      const enriched = { ...unit, lessons, progress: unitProgress }
      prevUnitDone = unitDone
      return enriched
    })
  }, [progress])

  const handleStartLesson = (unitId, lessonId) => {
    navigate(`/academia/leccion/${unitId}/${lessonId}`)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          {t('academy.title')}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
          {t('academy.subtitle')}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-10">
        <StatsBar
          streak={progress.streak}
          xp={progress.xp}
          hearts={progress.hearts}
          level={level}
        />
      </div>

      {/* Daily goal pill */}
      <div className="mb-10 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 px-5 py-2">
          <span className="text-lg">🎯</span>
          <span className="text-sm font-semibold text-accent-700 dark:text-accent-300">
            {t('academy.daily_goal')}
          </span>
          <span className="text-xs text-accent-600 dark:text-accent-400">
            {t('academy.daily_goal_desc', { n: 3 })}
          </span>
        </div>
      </div>

      {/* Learning path */}
      <div className="flex flex-col gap-14">
        {units.map((unit, i) => (
          <UnitCard
            key={unit.id}
            unit={unit}
            unitIndex={i}
            onStartLesson={handleStartLesson}
          />
        ))}
      </div>
    </div>
  )
}
