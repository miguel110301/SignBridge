import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import HandDetector from '../translator/HandDetector.jsx'
import MaxWidthWrapper from './components/MaxWidthWrapper.jsx'
import { completePracticeMission, fetchPracticeModules } from './practiceClient.js'
import { isFundamentalsModuleTitle } from './moduleRoutes.js'
import {
  formatPracticeDetection,
  matchesPracticeObjective,
  resolvePracticeObjective,
} from './practiceObjective.js'

function resolveFundamentalsModule(modules) {
  return (
    modules.find((moduleItem) => isFundamentalsModuleTitle(moduleItem.title))
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

export default function FundamentosLsmModulePage() {
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

  const fundamentalsModule = useMemo(() => {
    return resolveFundamentalsModule(modules)
  }, [modules])

  const objectiveMission = useMemo(() => {
    return resolveObjectiveMission(fundamentalsModule)
  }, [fundamentalsModule])

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
      <div className="flex min-h-[calc(100dvh-65px)] items-center justify-center bg-[#030712] px-4 text-white">
        <div className="rounded-2xl border border-[#1c2740] bg-[#0a1324] px-6 py-5 text-sm text-[#9db0d2]">
          Cargando modulo...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100dvh-65px)] items-center justify-center bg-[#030712] px-4 text-white">
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

  if (!fundamentalsModule) {
    return (
      <div className="flex min-h-[calc(100dvh-65px)] items-center justify-center bg-[#030712] px-4 text-white">
        <div className="max-w-xl rounded-2xl border border-[#1c2740] bg-[#0a1324] p-6">
          <p className="text-sm text-[#9db0d2]">
            No encontramos el modulo Fundamentos de LSM en este momento.
          </p>
          <Link
            to="/practica"
            className="mt-4 inline-flex rounded-md border border-[#5b57ff]/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-[#b8b5ff] transition-colors hover:bg-[#5b57ff]/20"
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
    <div className="min-h-[calc(100dvh-65px)] bg-[#030712] text-white">
      <MaxWidthWrapper className="py-9 sm:py-12">
        <Link
          to="/practica"
          className="inline-flex text-xs font-semibold uppercase tracking-[0.16em] text-[#9fb0d8] transition-colors hover:text-white"
        >
          Volver a practica
        </Link>

        <h1 className="mt-4 text-[2.4rem] font-medium tracking-tight text-white sm:text-[2.95rem]">
          {fundamentalsModule.title}
        </h1>
        <p className="mt-3 max-w-3xl text-[1.05rem] leading-relaxed text-[#9db0d2]">
          {fundamentalsModule.description || 'Practica guiada del modulo base de LSM.'}
        </p>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="rounded-3xl border border-[#1c2740] bg-[#0a1324] p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9fb0d8]">
              Camara
            </p>
            <div className="mt-4">
              <HandDetector onSignDetected={setDetectedSign} />
            </div>
          </div>

          <aside className="rounded-3xl border border-[#1c2740] bg-[#0a1324] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9fb0d8]">
              Objetivo actual
            </p>

            <div className="mt-4 rounded-2xl border border-[#172540] bg-[#081224] p-5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#7f93b4]">
                {objective.title}
              </p>
              <p className={`mt-2 font-semibold text-white ${
                objective.type === 'letter'
                  ? 'text-[4.1rem] leading-none'
                  : 'text-2xl leading-tight sm:text-3xl'
              }`}>
                {objective.display}
              </p>
              <p className="mt-3 text-[1.02rem] font-medium text-white">
                {objectiveMission?.title || 'Sin objetivo configurado.'}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#9db0d2]">
                {objectiveMission?.description || 'Enfoca la mano al centro de la camara para iniciar la practica.'}
              </p>
            </div>

            <p className="mt-4 text-sm text-[#9fb0d8]">
              Deteccion actual: <span className="font-semibold text-white">{formatPracticeDetection(detectedSign)}</span>
            </p>

            {objectiveMatched && (
              <p className="mt-2 rounded-md border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                La deteccion coincide con el objetivo actual.
              </p>
            )}

            {!objective.supported && (
              <p className="mt-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#9db0d2]">
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
              className="mt-6 w-full rounded-full border border-[#5b57ff]/45 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-[#b8b5ff] transition-colors hover:bg-[#5b57ff]/20 disabled:cursor-not-allowed disabled:opacity-50"
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
