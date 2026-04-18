"use client";

import Link from "next/link";
import { Menu, X, Sun, Moon, Globe, Hand } from "lucide-react";
import { useState } from "react";
import { useI18n } from "./i18n-provider";
import { useTheme } from "./theme-provider";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { locale, setLocale, t } = useI18n();
  const { theme, toggleTheme } = useTheme();

  const navLinks = [
    { label: t("nav.features") as string, href: "#features" },
    { label: t("nav.howItWorks") as string, href: "#how-it-works" },
    { label: t("nav.testimonials") as string, href: "#testimonials" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-800">
            <Hand className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-[var(--foreground)]">
            Sign<span className="text-primary-700 dark:text-primary-400">Bridge</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={() => setLocale(locale === "es" ? "en" : "es")}
            className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]"
          >
            <Globe className="h-4 w-4" />
            {locale.toUpperCase()}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          {/* CTA */}
          <Link
            href="#cta"
            className="hidden rounded-full bg-primary-800 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 md:inline-flex"
          >
            {t("nav.cta")}
          </Link>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--background)] px-4 pb-4 md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-sm font-medium text-[var(--muted-foreground)]"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="#cta"
            onClick={() => setMobileOpen(false)}
            className="mt-2 block rounded-full bg-primary-800 px-5 py-2.5 text-center text-sm font-semibold text-white"
          >
            {t("nav.cta")}
          </Link>
        </div>
      )}
    </header>
  );
}
