export default function MissionList({
  missions,
  onCompleteMission,
  completingMissionId = null,
}) {
  return (
    <div className="space-y-10">
      {missions.map((missionItem) => (
        <article key={missionItem.id}>
          <div className="flex items-start justify-between gap-6">
            <h4 className="text-[1.6rem] font-medium leading-tight text-white">{missionItem.title}</h4>
            <span className="pt-2 text-[0.8rem] font-semibold uppercase tracking-[0.16em] text-[#a8b7d4]">
              {missionItem.completed ? 'Completada' : 'Pendiente'}
            </span>
          </div>

          <p className="mt-2 max-w-xl text-[1.04rem] leading-relaxed text-[#9db0d2]">
            {missionItem.description}
          </p>

          <div className="mt-3 flex items-center gap-5 text-[0.92rem] text-[#7f93b4]">
            <span>+{missionItem.xpReward} XP</span>
            <span>Mision {missionItem.displayOrder}</span>
            {!missionItem.completed && onCompleteMission ? (
              <button
                type="button"
                onClick={() => onCompleteMission(missionItem.id)}
                disabled={completingMissionId === missionItem.id}
                className="rounded-full border border-[#5b57ff]/45 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-[#b8b5ff] transition-colors hover:bg-[#5b57ff]/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {completingMissionId === missionItem.id
                  ? 'Guardando...'
                  : 'Marcar completada'}
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  )
}
