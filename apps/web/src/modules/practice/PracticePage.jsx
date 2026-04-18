import { useEffect, useMemo, useState } from 'react'
import Badge from './components/Badge.jsx'
import MaxWidthWrapper from './components/MaxWidthWrapper.jsx'
import MissionList from './components/MissionList.jsx'
import ModulePathCard from './components/ModulePathCard.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { completePracticeMission, fetchPracticeModules } from './practiceClient.js'
import { getPracticeModuleDetailPath } from './moduleRoutes.js'

function resolveActiveModuleId(currentModuleId, nextModules) {
	if (currentModuleId && nextModules.some((moduleItem) => moduleItem.id === currentModuleId)) {
		return currentModuleId
	}

	return (
		nextModules.find((moduleItem) => moduleItem.completionRate < 100)?.id
		|| nextModules[0]?.id
		|| null
	)
}

export default function PracticePage() {
	const { token } = useAuth()
	const [modules, setModules] = useState([])
	const [activeModuleId, setActiveModuleId] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [actionError, setActionError] = useState('')
	const [completingMissionId, setCompletingMissionId] = useState(null)
	const [reloadNonce, setReloadNonce] = useState(0)

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
				setActiveModuleId((currentModuleId) => resolveActiveModuleId(currentModuleId, nextModules))
			} catch (requestError) {
				if (!isActive) return
				setModules([])
				setActiveModuleId(null)
				setError(requestError.message || 'No se pudieron cargar los modulos.')
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

	async function handleCompleteMission(missionId) {
		if (!token || !missionId) return

		setCompletingMissionId(missionId)
		setActionError('')

		try {
			await completePracticeMission(missionId, token)
			const payload = await fetchPracticeModules(token)
			const nextModules = Array.isArray(payload.modules) ? payload.modules : []

			setModules(nextModules)
			setActiveModuleId((currentModuleId) => resolveActiveModuleId(currentModuleId, nextModules))
		} catch (requestError) {
			setActionError(requestError.message || 'No se pudo completar la mision.')
		} finally {
			setCompletingMissionId(null)
		}
	}

	const activeModule = useMemo(
		() => modules.find((moduleItem) => moduleItem.id === activeModuleId) ?? modules[0] ?? null,
		[activeModuleId, modules]
	)

	if (loading) {
		return (
			<div className="flex min-h-[calc(100dvh-65px)] items-center justify-center bg-[#030712] px-4 text-white">
				<div className="rounded-2xl border border-[#1c2740] bg-[#0a1324] px-6 py-5 text-sm text-[#9db0d2]">
					Cargando ruta de aprendizaje...
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

	if (modules.length === 0 || !activeModule) {
		return (
			<div className="flex min-h-[calc(100dvh-65px)] items-center justify-center bg-[#030712] px-4 text-white">
				<div className="rounded-2xl border border-[#1c2740] bg-[#0a1324] px-6 py-5 text-sm text-[#9db0d2]">
					Aun no hay modulos disponibles en la base de datos.
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-[calc(100dvh-65px)] bg-[#030712] text-white">
			<MaxWidthWrapper className="py-9 sm:py-12">
				<div className="max-w-[1140px]">
					<Badge>PRACTICE MODE</Badge>
					<h1 className="mt-4 text-[2.6rem] font-medium tracking-tight text-white sm:text-[3.25rem]">
						Ruta de aprendizaje
					</h1>
				</div>

				<section className="mt-10 grid gap-14 lg:grid-cols-[1.08fr_0.92fr] xl:gap-20">
					<div>
						<h2 className="mb-8 text-xs font-semibold uppercase tracking-[0.24em] text-[#9fb0d8]">
							Modulos
						</h2>

						<div className="space-y-8">
							{modules.map((moduleItem, index) => (
								<ModulePathCard
									key={moduleItem.id}
									moduleItem={moduleItem}
									isActive={moduleItem.id === activeModule?.id}
									isLast={index === modules.length - 1}
									onSelect={setActiveModuleId}
									detailPath={getPracticeModuleDetailPath(moduleItem.title)}
								/>
							))}
						</div>
					</div>

					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5b57ff]">
							Modulo seleccionado
						</p>
						{actionError ? (
							<p className="mt-3 rounded-md border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-100">
								{actionError}
							</p>
						) : null}
						<h3 className="mt-4 text-[2.1rem] font-medium leading-tight text-white sm:text-[2.45rem]">
							{activeModule.title}
						</h3>
						<p className="mt-3 max-w-xl text-[1.05rem] leading-relaxed text-[#9db0d2]">
							{activeModule.description || 'Sin descripcion disponible.'}
						</p>

						<div className="mt-10">
							<MissionList
								missions={activeModule.missions}
								onCompleteMission={handleCompleteMission}
								completingMissionId={completingMissionId}
							/>
						</div>
					</div>
				</section>
			</MaxWidthWrapper>
		</div>
	)
}
