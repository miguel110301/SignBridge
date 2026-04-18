import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nProvider.jsx'
import useAcademyProgress from './useAcademyProgress.js'
import { curriculum, generateQuestions } from './academyData.js'

export default function LessonPage() {
  const { unitId, lessonId } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { hearts, loseHeart, completeLesson } = useAcademyProgress()

  /* Find lesson data */
  const unit   = curriculum.find(u => u.id === unitId)
  const lesson = unit?.lessons.find(l => l.id === lessonId)

  const questions = useMemo(
    () => lesson ? generateQuestions(lesson.signs, lang) : [],
    [lesson, lang],
  )

  const [step, setStep]         = useState(0)
  const [selected, setSelected] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [showQuit, setShowQuit] = useState(false)

  const current   = questions[step]
  const totalQ    = questions.length
  const progressPct = totalQ > 0 ? ((step) / totalQ) * 100 : 0
  const isLast    = step === totalQ - 1

  const handleSelect = useCallback((key) => {
    if (confirmed) return
    setSelected(key)
  }, [confirmed])

  const handleConfirm = useCallback(() => {
    if (selected === null) return
    setConfirmed(true)
    const isCorrect = selected === current.correctAnswer
    if (isCorrect) setCorrectCount(c => c + 1)
    else loseHeart()
  }, [selected, current, loseHeart])

  const handleNext = useCallback(() => {
    if (isLast) {
      /* Finish lesson → go to results */
      const score = Math.round(((correctCount + (selected === current?.correctAnswer ? 1 : 0)) / totalQ) * 100)
      const finalCorrect = correctCount + (confirmed && selected === current?.correctAnswer ? 0 : 0)
      // Score is already counted via correctCount in handleConfirm
      const adjustedScore = Math.round((correctCount / totalQ) * 100)
      completeLesson(unitId, lessonId, adjustedScore, lesson?.xpReward || 10)
      navigate(`/academia/resultado/${unitId}/${lessonId}`, {
        state: { score: adjustedScore, xp: lesson?.xpReward || 10, total: totalQ, correct: correctCount },
      })
    } else {
      setStep(s => s + 1)
      setSelected(null)
      setConfirmed(false)
    }
  }, [isLast, correctCount, totalQ, unitId, lessonId, lesson, completeLesson, navigate, selected, current, confirmed])

  /* No hearts left */
  if (hearts <= 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="text-6xl">💔</span>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('academy.incorrect')}</h2>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">{t('academy.try_again')}</p>
        <button type="button" onClick={() => navigate('/academia')} className="btn-primary mt-4">
          {t('academy.results.back_to_academy')}
        </button>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    )
  }

  const isCorrect = selected === current.correctAnswer

  return (
    <div className="mx-auto flex max-w-xl flex-col px-4 py-6 sm:py-10 min-h-[80vh]">
      {/* Top bar: progress + hearts + quit */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => setShowQuit(true)}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          aria-label="Close"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Progress bar */}
        <div className="flex-1 h-3 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Hearts */}
        <div className="flex items-center gap-1">
          <span className="text-red-500">❤️</span>
          <span className="text-sm font-bold text-red-500">{hearts}</span>
        </div>
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {/* Question type label */}
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-500 dark:text-brand-400">
          {t(`academy.lesson_types.${current.type}`)}
        </p>

        {/* Sign display */}
        <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-brand-50 dark:bg-brand-900/30 border-2 border-brand-200 dark:border-brand-800 shadow-inner">
          <span className="text-5xl font-black text-brand-700 dark:text-brand-300">
            {current.type === 'sign_to_text' ? '🤟' : current.signLabel}
          </span>
        </div>

        {current.type === 'sign_to_text' && (
          <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
            {t('academy.lesson_types.sign_to_text')}
          </p>
        )}
        {current.type === 'multiple_choice' && (
          <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
            {t('academy.lesson_types.multiple_choice')}
          </p>
        )}

        {/* Options grid */}
        <div className="grid w-full grid-cols-2 gap-3">
          {current.options.map(opt => {
            let optClasses = 'rounded-2xl border-2 px-4 py-4 text-center font-semibold transition-all text-sm sm:text-base '
            if (!confirmed) {
              optClasses += selected === opt.key
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 scale-[1.02]'
                : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:border-brand-300 dark:hover:border-brand-600'
            } else if (opt.key === current.correctAnswer) {
              optClasses += 'border-accent-500 bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300'
            } else if (opt.key === selected) {
              optClasses += 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            } else {
              optClasses += 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 opacity-50'
            }

            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleSelect(opt.key)}
                disabled={confirmed}
                className={optClasses}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Feedback bar */}
      {confirmed && (
        <div className={`mt-4 rounded-2xl p-4 text-center font-bold ${
          isCorrect
            ? 'bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300'
            : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
        }`}>
          {isCorrect ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {t('academy.correct')}
            </span>
          ) : (
            <span>{t('academy.incorrect')} — {current.options.find(o => o.key === current.correctAnswer)?.label}</span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex gap-3">
        {!confirmed ? (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selected === null}
            className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('academy.next')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="btn-primary flex-1"
          >
            {isLast ? t('academy.finish') : t('academy.next')}
          </button>
        )}
      </div>

      {/* Quit confirmation modal */}
      {showQuit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl text-center">
            <p className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t('academy.quit_confirm')}</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/academia')}
                className="flex-1 rounded-2xl border-2 border-red-300 dark:border-red-700 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400 transition-all hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                {t('academy.quit_yes')}
              </button>
              <button
                type="button"
                onClick={() => setShowQuit(false)}
                className="btn-primary flex-1"
              >
                {t('academy.quit_no')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
