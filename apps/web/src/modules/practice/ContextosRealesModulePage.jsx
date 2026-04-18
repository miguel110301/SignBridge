import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import HandDetector from '../translator/HandDetector.jsx'
import MaxWidthWrapper from './components/MaxWidthWrapper.jsx'
import { completePracticeMission, fetchPracticeModules } from './practiceClient.js'
import { isContextosRealesModuleTitle } from './moduleRoutes.js'
import {
  formatPracticeDetection,
  matchesPracticeObjective,
  resolvePracticeObjective,
} from './practiceObjective.js'

function resolveContextosRealesModule(modules) {
  return (
    modules.find((moduleItem) => isContextosRealesModuleTitle(moduleItem.title))
    ?? null
  )
}

function resolveObjectiveMission(moduleItem) {
  if (!moduleItem?.missions?.length) return null

  return (
    moduleItem.missions.find((missionItem) => !missionItem.completed)
    ?? moduleItem.missions[0]
  )
}

export default function ContextosRealesModulePage() {
  const { token } = useAuth()
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [detectedSign, setDetectedSign] = useState(null)
  const [completingMissionId, setCompletingMissionId] = useState(null)

  useEffect(() => {
    let isActive = true

    async function loadModules() {
      if (!token) return

      setLoading(true)
      setError('')
      setActionError('')

      try {
        const payload = await fetchPracticeModules(token)
        if (!isActive) return

        const nextModules = Array.isArray(payload.modules) ? payload.modules : []
        setModules(nextModules)
      } catch (requestError) {
        if (!isActive) return

        setModules([])
        setError(requestError.message || 'No se pudo cargar el modulo.')
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    loadModules()

    return () => {
      isActive = false
    }
  }, [reloadNonce, token])

  const moduleData = useMemo(() => {
    return resolveContextosRealesModule(modules)
  }, [modules])

  const objectiveMission = useMemo(() => {
    return resolveObjectiveMission(moduleData)
  }, [moduleData])

  const objective = useMemo(() => {
    return resolvePracticeObjective(objectiveMission)
  }, [objectiveMission])

  const objectiveMatched = useMemo(() => {
    return matchesPracticeObjective(detectedSign, objective)
  }, [detectedSign, objective])

  async function handleCompleteObjective() {
    if (!token || !objectiveMission?.id || objectiveMission.completed) return

    setCompletingMissionId(objectiveMission.id)
    setActionError('')

    try {
      await completePracticeMission(objectiveMission.id, token)
      const payload = await fetchPracticeModules(token)
      const nextModules = Array.isArray(payload.modules) ? payload.modules : []
      setModules(nextModules)
    } catch (requestError) {
      setActionError(requestError.message || 'No se pudo completar el objetivo.')
    } finally {
      setCompletingMissionId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-65px)] items-center justify-center bg-zinc-950 px-4 text-white">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-5 text-sm text-zinc-400">
          Cargando modulo...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100dvh-65px)] items-center justify-center bg-zinc-950 px-4 text-white">
        <div className="max-w-xl rounded-2xl border border-red-500/30 bg-red-950/20 p-6">
          <p className="text-sm text-red-100">{error}</p>
          <button
            type="button"
            onClick={() => setReloadNonce((value) => value + 1)}
            className="mt-4 rounded-md border border-red-300/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-red-100 transition-colors hover:bg-red-500/20"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!moduleData) {
    return (
      <div className="flex min-h-[calc(100dvh-65px)] items-center justify-center bg-zinc-950 px-4 text-white">
        <div className="max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">
            No encontramos el modulo Contextos Reales en este momento.
          </p>
          <Link
            to="/practica"
            className="mt-4 inline-flex rounded-md border border-brand-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-brand-200 transition-colors hover:bg-brand-400/20"
          >
            Volver a practica
          </Link>
        </div>
      </div>
    )
  }

  const isCompleted = Boolean(objectiveMission?.completed)
  const isSaving = objectiveMission?.id && completingMissionId === objectiveMission.id

  return (
    <div className="min-h-[calc(100dvh-65px)] bg-zinc-950 text-white">
      <MaxWidthWrapper className="py-9 sm:py-12">
        <Link
          to="/practica"
          className="inline-flex text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:text-white"
        >
          Volver a practica
        </Link>

        <h1 className="mt-4 text-4xl font-medium tracking-tight text-white sm:text-5xl">
          {moduleData.title}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
          {moduleData.description || 'Practica guiada para aplicar LSM en contextos reales.'}
        </p>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
              Camara
            </p>
            <div className="mt-4">
              <HandDetector onSignDetected={setDetectedSign} />
            </div>
          </div>

          <aside className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
              Objetivo actual
            </p>

            <div className="mt-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {objective.title}
              </p>
              <p className={`mt-2 font-semibold text-white ${
                objective.type === 'letter'
                  ? 'text-7xl leading-none'
                  : 'text-2xl leading-tight sm:text-3xl'
              }`}>
                {objective.display}
              </p>
              <p className="mt-3 text-base font-medium text-white">
                {objectiveMission?.title || 'Sin objetivo configurado.'}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {objectiveMission?.description || 'Enfoca la mano al centro de la camara para iniciar la practica.'}
              </p>
            </div>

            <p className="mt-4 text-sm text-zinc-400">
              Deteccion actual: <span className="font-semibold text-white">{formatPracticeDetection(detectedSign)}</span>
            </p>

            {objectiveMatched && (
              <p className="mt-2 rounded-md border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                La deteccion coincide con el objetivo actual.
              </p>
            )}

            {!objective.supported && (
              <p className="mt-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-400">
                La validacion automatica de practica esta disponible por ahora para letras estaticas y el gesto HOLA.
              </p>
            )}

            {actionError ? (
              <p className="mt-4 rounded-md border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-100">
                {actionError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleCompleteObjective}
              disabled={!objectiveMission?.id || isCompleted || isSaving}
              className="mt-6 w-full rounded-full border border-brand-400/40 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-brand-200 transition-colors hover:bg-brand-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving
                ? 'Guardando...'
                : isCompleted
                  ? 'Objetivo completado'
                  : 'Marcar como completada'}
            </button>
          </aside>
        </section>
      </MaxWidthWrapper>
    </div>
  )
}
