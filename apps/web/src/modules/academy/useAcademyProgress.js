import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'signbridge_academy'

const defaults = {
  streak: 0,
  xp: 0,
  hearts: 5,
  lastActiveDate: null,
  completedLessons: {},   // { 'alphabet:lesson-1': { score, xp, date } }
  currentLesson: null,    // { unitId, lessonId }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults }
  } catch {
    return { ...defaults }
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/**
 * Custom hook that manages all academy progress state.
 */
export default function useAcademyProgress() {
  const [state, setState] = useState(load)

  useEffect(() => { save(state) }, [state])

  /* Refresh streak based on date */
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    setState(prev => {
      if (prev.lastActiveDate === today) return prev
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
      const streak = prev.lastActiveDate === yesterday ? prev.streak : 0
      return { ...prev, streak, hearts: 5 }
    })
  }, [])

  const completeLesson = useCallback((unitId, lessonId, score, xpEarned) => {
    const key = `${unitId}:${lessonId}`
    const today = new Date().toISOString().slice(0, 10)
    setState(prev => {
      const existing = prev.completedLessons[key]
      const bestScore = existing ? Math.max(existing.score, score) : score
      return {
        ...prev,
        xp: prev.xp + xpEarned,
        streak: prev.lastActiveDate === today ? prev.streak : prev.streak + 1,
        lastActiveDate: today,
        completedLessons: {
          ...prev.completedLessons,
          [key]: { score: bestScore, xp: xpEarned, date: today },
        },
        currentLesson: null,
      }
    })
  }, [])

  const loseHeart = useCallback(() => {
    setState(prev => ({ ...prev, hearts: Math.max(0, prev.hearts - 1) }))
  }, [])

  const startLesson = useCallback((unitId, lessonId) => {
    setState(prev => ({ ...prev, currentLesson: { unitId, lessonId } }))
  }, [])

  const cancelLesson = useCallback(() => {
    setState(prev => ({ ...prev, currentLesson: null }))
  }, [])

  const isLessonCompleted = useCallback((unitId, lessonId) => {
    return !!state.completedLessons[`${unitId}:${lessonId}`]
  }, [state.completedLessons])

  const getLessonScore = useCallback((unitId, lessonId) => {
    return state.completedLessons[`${unitId}:${lessonId}`]?.score ?? 0
  }, [state.completedLessons])

  const totalMastered = Object.keys(state.completedLessons).length

  return {
    ...state,
    totalMastered,
    completeLesson,
    loseHeart,
    startLesson,
    cancelLesson,
    isLessonCompleted,
    getLessonScore,
  }
}
