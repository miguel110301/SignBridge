import Link from "next/link";
import type { ReactNode } from "react";

interface ShinyButtonProps {
  children: ReactNode;
  href?: string;
  className?: string;
  onClick?: () => void;
}

export function ShinyButton({ children, href, className = "", onClick }: ShinyButtonProps) {
  const base =
    "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-primary-800 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-primary-700 hover:shadow-primary-500/25 active:scale-[0.98]";

  const shimmer = (
    <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
  );

  if (href) {
    return (
      <Link href={href} className={`${base} ${className}`}>
        {shimmer}
        <span className="relative">{children}</span>
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={`${base} ${className}`}>
      {shimmer}
      <span className="relative">{children}</span>
    </button>
  );
}
