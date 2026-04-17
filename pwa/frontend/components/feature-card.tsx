import type { ComponentType, SVGProps } from "react";

interface FeatureCardProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 transition-all hover:border-primary-400 hover:shadow-lg hover:shadow-primary-500/10">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}
