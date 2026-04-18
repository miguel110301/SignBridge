import type { ReactNode } from "react";

interface HeadingProps {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}

export function Heading({ children, className = "", as: Tag = "h2" }: HeadingProps) {
  return (
    <Tag
      className={`text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl md:text-6xl ${className}`}
    >
      {children}
    </Tag>
  );
}
