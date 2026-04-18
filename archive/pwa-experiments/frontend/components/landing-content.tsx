"use client";

import {
  Check,
  Star,
  Zap,
  Users,
  Hand as HandIcon,
  Calendar,
  Brain,
  Eye,
  Volume2,
  TrendingUp,
  MessageSquare,
  BarChart3,
  Shield,
} from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";
import { Heading } from "@/components/heading";
import { Badge } from "@/components/badge";
import { FeatureCard } from "@/components/feature-card";
import { ShinyButton } from "@/components/shiny-button";
import { BentoGrid } from "@/components/bento-grid";
import { Testimonials } from "@/components/testimonials";

export function LandingContent() {
  const { t } = useI18n();

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(109,40,217,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(109,40,217,0.25),transparent)]" />

        <MaxWidthWrapper className="text-center">
          <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-8">
            {/* Badge */}
            <Badge>
              <Zap className="h-4 w-4 text-primary-700 dark:text-primary-400" />
              <span>{t("hero.badge")}</span>
            </Badge>

            {/* Heading */}
            <Heading as="h1" className="text-balance">
              <span>{t("hero.title")}</span>{" "}
              <span className="bg-gradient-to-r from-primary-800 to-primary-500 bg-clip-text text-transparent dark:from-primary-400 dark:to-primary-200">
                {t("hero.titleHighlight")}
              </span>
            </Heading>

            {/* Description */}
            <p className="max-w-2xl text-pretty text-lg text-[var(--muted-foreground)] sm:text-xl">
              {t("hero.description")}
            </p>

            {/* Feature checklist */}
            <ul className="flex flex-col items-start gap-2 text-left text-base text-[var(--muted-foreground)] sm:items-center">
              {[
                t("hero.feature1") as string,
                t("hero.feature2") as string,
                t("hero.feature3") as string,
              ].map((item, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Check className="h-5 w-5 shrink-0 text-secondary-500" />
                  {item}
                </li>
              ))}
            </ul>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <ShinyButton href="#cta">{t("hero.cta")}</ShinyButton>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] px-8 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
              >
                {t("hero.ctaSecondary")}
              </a>
            </div>

            {/* Social proof */}
            <div className="flex flex-col items-center gap-4 pt-8">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--background)] bg-primary-100 text-xs font-bold text-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                  >
                    U{i}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                {t("hero.socialProof", { count: 500 })}
              </p>
            </div>
          </div>
        </MaxWidthWrapper>
      </section>

      {/* Dashboard Preview Section */}
      <section className="relative pb-4">
        <div className="absolute inset-x-0 bottom-24 top-24 bg-primary-800" />
        <MaxWidthWrapper className="relative">
          <div className="-m-2 rounded-xl bg-[var(--foreground)]/5 p-2 ring-1 ring-inset ring-[var(--foreground)]/10 lg:-m-4 lg:rounded-2xl lg:p-4">
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[var(--card)] shadow-2xl">
              <div className="flex h-full">
                {/* Sidebar */}
                <div className="hidden w-64 border-r border-[var(--border)] bg-[var(--card)] p-4 md:block">
                  <div className="mb-8 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-800">
                      <HandIcon className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-bold text-[var(--foreground)]">SignBridge</span>
                  </div>
                  <nav className="space-y-1">
                    {[
                      t("preview.sidebar.dashboard") as string,
                      t("preview.sidebar.patients") as string,
                      t("preview.sidebar.translator") as string,
                      t("preview.sidebar.history") as string,
                      t("preview.sidebar.settings") as string,
                    ].map((item, i) => (
                      <div
                        key={item}
                        className={`rounded-lg px-3 py-2 text-sm ${
                          i === 0
                            ? "bg-primary-100 font-medium text-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                            : "text-[var(--muted-foreground)]"
                        }`}
                      >
                        {item}
                      </div>
                    ))}
                  </nav>
                </div>
                {/* Main content */}
                <div className="flex-1 p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-[var(--foreground)]">
                      {t("preview.welcome", { name: "García" })}
                    </h2>
                    <p className="text-[var(--muted-foreground)]">{t("preview.summary")}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      { label: t("preview.stats.patients") as string, value: "12", icon: Users },
                      { label: t("preview.stats.translations") as string, value: "34", icon: Calendar },
                      { label: t("preview.stats.satisfaction") as string, value: "98%", icon: Brain },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4"
                      >
                        <div className="flex items-center justify-between">
                          <stat.icon className="h-5 w-5 text-primary-700 dark:text-primary-400" />
                          <Badge>+12%</Badge>
                        </div>
                        <p className="mt-4 text-2xl font-bold text-[var(--foreground)]">
                          {stat.value}
                        </p>
                        <p className="text-sm text-[var(--muted-foreground)]">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </MaxWidthWrapper>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 sm:py-32">
        <MaxWidthWrapper>
          <div className="mb-16 text-center">
            <Badge className="mb-4">{t("features.badge")}</Badge>
            <Heading className="text-3xl sm:text-4xl md:text-5xl">
              {t("features.title") as string}
            </Heading>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted-foreground)]">
              {t("features.description")}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Eye}
              title={t("features.signDetection.title") as string}
              description={t("features.signDetection.description") as string}
            />
            <FeatureCard
              icon={Volume2}
              title={t("features.textToSpeech.title") as string}
              description={t("features.textToSpeech.description") as string}
            />
            <FeatureCard
              icon={Brain}
              title={t("features.aiAssistant.title") as string}
              description={t("features.aiAssistant.description") as string}
            />
            <FeatureCard
              icon={TrendingUp}
              title={t("features.progressTracking.title") as string}
              description={t("features.progressTracking.description") as string}
            />
            <FeatureCard
              icon={MessageSquare}
              title={t("features.bidirectional.title") as string}
              description={t("features.bidirectional.description") as string}
            />
            <FeatureCard
              icon={BarChart3}
              title={t("features.analytics.title") as string}
              description={t("features.analytics.description") as string}
            />
          </div>
        </MaxWidthWrapper>
      </section>

      {/* Bento Grid */}
      <BentoGrid />

      {/* Testimonials */}
      <Testimonials />

      {/* CTA Section */}
      <section id="cta" className="py-24 sm:py-32">
        <MaxWidthWrapper>
          <div className="relative overflow-hidden rounded-3xl bg-primary-800 px-6 py-16 text-center shadow-2xl sm:px-16 sm:py-24">
            {/* Background pattern */}
            <div className="absolute inset-0 -z-10 opacity-20">
              <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#grid)" />
              </svg>
            </div>

            <Shield className="mx-auto mb-6 h-12 w-12 text-white" />
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {t("cta.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
              {t("cta.description")}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <ShinyButton
                href="#"
                className="bg-white text-primary-800 hover:bg-white/90"
              >
                {t("cta.button")}
              </ShinyButton>
            </div>
          </div>
        </MaxWidthWrapper>
      </section>
    </>
  );
}
