/**
 * PracticePage.jsx
 *
 * Full practice module: pick a letter → practice with your camera →
 * see real-time detection + scoring → track mastery progress.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useI18n } from '../../i18n/I18nProvider.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { classifySign, createSmoother } from '@signbridge/sign-engine'
import { useHandDetection } from '../../hooks/useHandDetection.js'

const ALPHABET = 'ABCDEFGHIJLMNOPRSTUVWY'.split('')
const MASTERY_THRESHOLD = 85
const HOLD_FRAMES = 12      // frames the sign must stay stable to count as "held"
const ROUND_QUESTIONS = 5    // attempts per letter before scoring

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
]

function drawLandmarks(landmarks, canvas) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const W = canvas.offsetWidth
  const H = canvas.offsetHeight
  canvas.width = W
  canvas.height = H
  ctx.clearRect(0, 0, W, H)

  ctx.fillStyle = '#7C3AED'
  for (const lm of landmarks) {
    ctx.beginPath()
    ctx.arc(lm.x * W, lm.y * H, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(124,58,237,0.5)'
  ctx.lineWidth = 2
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath()
    ctx.moveTo(landmarks[a].x * W, landmarks[a].y * H)
    ctx.lineTo(landmarks[b].x * W, landmarks[b].y * H)
    ctx.stroke()
  }
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function LetterTile({ letter, status, bestScore, onClick }) {
  const bg =
    status === 'mastered'
      ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25'
      : status === 'attempted'
        ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-700'
        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl text-lg font-bold transition-all active:scale-95 hover:ring-2 hover:ring-brand-400 ${bg}`}
    >
      {letter}
      {status === 'mastered' && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-accent-600 shadow text-[10px]">✓</span>
      )}
      {status === 'attempted' && bestScore > 0 && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
          {bestScore}%
        </span>
      )}
    </button>
  )
}

function SessionStats({ practiced, correct, total, streak }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-wrap justify-center gap-3 text-center">
      {[
        { label: t('practice.letters_practiced'), value: practiced, icon: '📝' },
        { label: t('practice.accuracy'), value: total > 0 ? `${Math.round((correct / total) * 100)}%` : '—', icon: '🎯' },
        { label: t('practice.streak'), value: streak, icon: '🔥' },
      ].map(s => (
        <div key={s.label} className="flex items-center gap-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2 shadow-sm">
          <span className="text-xl">{s.icon}</span>
          <div className="text-left">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{s.label}</p>
            <p className="text-sm font-bold text-zinc-900 dark:text-white">{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function PracticePage() {
  const { t } = useI18n()
  const { user } = useAuth()

  /* Progress state (localStorage + optional API sync) */
  const [progress, setProgress] = useState(() => {
    try {
      const raw = localStorage.getItem('signbridge_practice')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })
  useEffect(() => { localStorage.setItem('signbridge_practice', JSON.stringify(progress)) }, [progress])

  /* Session stats */
  const [session, setSession] = useState({ practiced: new Set(), correct: 0, total: 0, streak: 0 })

  /* Drill state */
  const [activeLetter, setActiveLetter] = useState(null)
  const [filter, setFilter]             = useState('all')

  /* Camera drill state */
  const [round, setRound]               = useState(0)
  const [roundCorrect, setRoundCorrect] = useState(0)
  const [holdCount, setHoldCount]        = useState(0)
  const [feedback, setFeedback]          = useState(null) // 'correct' | 'wrong' | null
  const [detectedLetter, setDetectedLetter] = useState(null)
  const [confidence, setConfidence]      = useState(0)
  const [showResult, setShowResult]      = useState(false)

  const canvasRef   = useRef(null)
  const smootherRef = useRef(createSmoother(8))
  const holdRef     = useRef(0)
  const roundRef    = useRef(0)
  const feedbackTimer = useRef(null)

  /* Keep roundRef in sync */
  useEffect(() => { roundRef.current = round }, [round])

  const handleLandmarks = useCallback((landmarks, meta = {}) => {
    if (!activeLetter || showResult) return

    const raw = classifySign(landmarks, meta)
    const stable = smootherRef.current.push(raw)

    setDetectedLetter(stable?.letter ?? null)
    setConfidence(stable?.confidence ?? 0)
    drawLandmarks(landmarks, canvasRef.current)

    if (stable && stable.letter === activeLetter) {
      holdRef.current++
      setHoldCount(holdRef.current)
      if (holdRef.current >= HOLD_FRAMES) {
        /* Correct! */
        holdRef.current = 0
        setHoldCount(0)
        setFeedback('correct')
        setRoundCorrect(rc => rc + 1)
        setSession(prev => ({
          ...prev,
          correct: prev.correct + 1,
          total: prev.total + 1,
          streak: prev.streak + 1,
          practiced: new Set([...prev.practiced, activeLetter]),
        }))
        advanceRound()
      }
    } else {
      if (holdRef.current > 3) {
        /* Had some hold but lost it — count as attempt */
        setSession(prev => ({ ...prev, total: prev.total + 1, streak: 0 }))
      }
      holdRef.current = 0
      setHoldCount(0)
    }
  }, [activeLetter, showResult])

  const advanceRound = useCallback(() => {
    clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => {
      setFeedback(null)
      const nextRound = roundRef.current + 1
      if (nextRound >= ROUND_QUESTIONS) {
        /* End of drill */
        setShowResult(true)
      } else {
        setRound(nextRound)
        smootherRef.current.reset()
      }
    }, 1200)
  }, [])

  const { videoRef, ready, error } = useHandDetection({
    onLandmarks: handleLandmarks,
    enabled: !!activeLetter && !showResult,
  })

  /* Start camera when entering drill */
  useEffect(() => {
    if (!activeLetter || !videoRef.current) return
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
      .then(stream => {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      })
      .catch(() => {})

    return () => {
      const stream = videoRef.current?.srcObject
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [activeLetter, videoRef])

  /* Save score on drill completion */
  useEffect(() => {
    if (!showResult || !activeLetter) return
    const score = Math.round((roundCorrect / ROUND_QUESTIONS) * 100)
    setProgress(prev => {
      const existing = prev[activeLetter] || { attempts: 0, bestScore: 0, mastered: false }
      return {
        ...prev,
        [activeLetter]: {
          attempts: existing.attempts + 1,
          bestScore: Math.max(existing.bestScore, score),
          mastered: existing.mastered || score >= MASTERY_THRESHOLD,
        },
      }
    })

    /* Optionally sync to API */
    if (user?._id) {
      const API = import.meta.env.VITE_API_URL || ''
      fetch(`${API}/api/progress/${user._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letter: activeLetter, score: Math.round((roundCorrect / ROUND_QUESTIONS) * 100) }),
      }).catch(() => {})
    }
  }, [showResult])

  /* Open a drill */
  const startDrill = (letter) => {
    setActiveLetter(letter)
    setRound(0)
    setRoundCorrect(0)
    setHoldCount(0)
    setFeedback(null)
    setShowResult(false)
    setDetectedLetter(null)
    setConfidence(0)
    holdRef.current = 0
    smootherRef.current.reset()
  }

  const exitDrill = () => {
    setActiveLetter(null)
    setShowResult(false)
  }

  const nextLetter = () => {
    const idx = ALPHABET.indexOf(activeLetter)
    const next = ALPHABET[(idx + 1) % ALPHABET.length]
    startDrill(next)
  }

  /* Filtered letters */
  const filtered = useMemo(() => {
    if (filter === 'mastered')    return ALPHABET.filter(l => progress[l]?.mastered)
    if (filter === 'in_progress') return ALPHABET.filter(l => progress[l] && !progress[l].mastered)
    if (filter === 'new')         return ALPHABET.filter(l => !progress[l])
    return ALPHABET
  }, [filter, progress])

  const masteredCount = ALPHABET.filter(l => progress[l]?.mastered).length

  /* ── DRILL VIEW ──────────────────────────────────────────────────────── */
  if (activeLetter) {
    const score = Math.round((roundCorrect / ROUND_QUESTIONS) * 100)
    const isMastered = score >= MASTERY_THRESHOLD

    return (
      <div className="mx-auto max-w-lg px-4 py-6 sm:py-10">
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-6">
          <button type="button" onClick={exitDrill} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 h-3 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${((round + (showResult ? 1 : 0)) / ROUND_QUESTIONS) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
            {round + (showResult ? 1 : 0)}/{ROUND_QUESTIONS}
          </span>
        </div>

        {/* ── Result view ────────────────────────────────────────────────── */}
        {showResult ? (
          <div className="flex flex-col items-center text-center gap-6 mt-8">
            <span className="text-6xl">{isMastered ? '🏆' : score >= 50 ? '👍' : '💪'}</span>
            <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
              {isMastered
                ? t('practice.congrats_mastered', { letter: activeLetter })
                : t('practice.not_mastered')}
            </h2>

            {/* Score ring */}
            <div className="relative h-28 w-28">
              <svg className="h-28 w-28 -rotate-90" viewBox="0 0 112 112">
                <circle cx="56" cy="56" r="48" fill="none" strokeWidth="8" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <circle cx="56" cy="56" r="48" fill="none" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={2 * Math.PI * 48 * (1 - score / 100)}
                  className={score >= MASTERY_THRESHOLD ? 'stroke-accent-500' : 'stroke-brand-500'}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-zinc-900 dark:text-white">
                {score}%
              </span>
            </div>

            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {roundCorrect}/{ROUND_QUESTIONS} {t('practice.correct').toLowerCase()}
            </p>

            <div className="flex w-full gap-3 mt-4">
              <button type="button" onClick={() => startDrill(activeLetter)} className="btn-outlined flex-1">
                {t('practice.retry')}
              </button>
              <button type="button" onClick={nextLetter} className="btn-primary flex-1">
                {t('practice.next_letter')}
              </button>
            </div>
            <button type="button" onClick={exitDrill} className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
              {t('practice.back')}
            </button>
          </div>
        ) : (
          /* ── Camera drill ──────────────────────────────────────────────── */
          <>
            {/* Target letter */}
            <div className="text-center mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-500 dark:text-brand-400 mb-2">
                {t('practice.show_sign')}
              </p>
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-50 dark:bg-brand-900/30 border-2 border-brand-200 dark:border-brand-800">
                <span className="text-4xl font-black text-brand-700 dark:text-brand-300">{activeLetter}</span>
              </div>
            </div>

            {/* Camera feed */}
            <div className="relative w-full aspect-[4/3] max-w-md mx-auto rounded-2xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
                muted
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ transform: 'scaleX(-1)' }}
              />

              {/* Loading overlay */}
              {!ready && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
                  <div className="text-center">
                    <div className="h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-zinc-400">{t('practice.loading_model')}</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-950/80 p-4">
                  <p className="text-red-300 text-sm text-center">{t('practice.camera_error')}</p>
                </div>
              )}

              {/* Detected sign + confidence HUD */}
              {ready && (
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="bg-zinc-900/80 backdrop-blur rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-3xl font-bold text-white">{detectedLetter ?? '—'}</span>
                      <span className="text-xs text-zinc-400">
                        {t('practice.confidence')}: {Math.round(confidence * 100)}%
                      </span>
                    </div>
                    {/* Confidence bar */}
                    <div className="h-1.5 rounded-full bg-zinc-700 overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-150"
                        style={{
                          width: `${confidence * 100}%`,
                          background: confidence > 0.8 ? '#10B981' : confidence > 0.5 ? '#eab308' : '#ef4444',
                        }}
                      />
                    </div>
                    {/* Hold progress */}
                    {detectedLetter === activeLetter && holdCount > 0 && (
                      <div className="h-2 rounded-full bg-zinc-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent-500 transition-all duration-100"
                          style={{ width: `${Math.min((holdCount / HOLD_FRAMES) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Feedback overlay */}
              {feedback === 'correct' && (
                <div className="absolute inset-0 flex items-center justify-center bg-accent-500/20 backdrop-blur-sm animate-pulse pointer-events-none">
                  <div className="rounded-full bg-accent-500 p-5 shadow-2xl shadow-accent-500/40">
                    <svg className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Status label */}
            <p className="mt-3 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {!ready ? t('practice.loading_model')
                : detectedLetter === activeLetter && holdCount > 0 ? t('practice.hold_steady')
                : detectedLetter ? t('practice.detecting')
                : t('practice.waiting_hand')}
            </p>
          </>
        )}
      </div>
    )
  }

  /* ── LETTER GRID VIEW ────────────────────────────────────────────────── */
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          {t('practice.title')}
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          {t('practice.desc')}
        </p>
      </div>

      {/* Session stats */}
      <div className="mb-6">
        <SessionStats
          practiced={session.practiced.size}
          correct={session.correct}
          total={session.total}
          streak={session.streak}
        />
      </div>

      {/* Mastery overview */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 px-5 py-2">
          <span className="text-lg">🎓</span>
          <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            {t('practice.mastered_count', { n: masteredCount, total: ALPHABET.length })}
          </span>
        </div>
      </div>

      {/* Mastery progress bar */}
      <div className="mb-8 mx-auto max-w-sm">
        <div className="h-3 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-700"
            style={{ width: `${(masteredCount / ALPHABET.length) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-center text-zinc-500 dark:text-zinc-400">
          {t('practice.mastery_threshold')}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex justify-center gap-2">
        {['all', 'mastered', 'in_progress', 'new'].map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              filter === f
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {t(`practice.filter_${f}`)}
          </button>
        ))}
      </div>

      {/* Prompt */}
      <p className="mb-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {t('practice.pick_letter')}
      </p>

      {/* Letter grid */}
      <div className="grid grid-cols-5 sm:grid-cols-7 gap-3 justify-items-center">
        {filtered.map(letter => {
          const p = progress[letter]
          const status = p?.mastered ? 'mastered' : p ? 'attempted' : 'new'
          return (
            <LetterTile
              key={letter}
              letter={letter}
              status={status}
              bestScore={p?.bestScore || 0}
              onClick={() => startDrill(letter)}
            />
          )
        })}
      </div>

      {masteredCount === ALPHABET.length && (
        <div className="mt-10 text-center">
          <span className="text-5xl">🎉</span>
          <p className="mt-2 text-lg font-bold text-accent-600 dark:text-accent-400">{t('practice.all_mastered')}</p>
        </div>
      )}
    </div>
  )
}
