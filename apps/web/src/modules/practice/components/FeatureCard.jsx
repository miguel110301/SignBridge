export default function FeatureCard({ icon, title, description }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition-colors hover:border-brand-500/35">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 text-lg">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{description}</p>
    </article>
  )
}
