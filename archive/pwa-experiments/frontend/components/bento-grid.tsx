"use client";

import { Smartphone, TrendingUp, Brain } from "lucide-react";
import { MaxWidthWrapper } from "./max-width-wrapper";
import { Heading } from "./heading";
import { Badge } from "./badge";
import { useI18n } from "./i18n-provider";

export function BentoGrid() {
  const { t } = useI18n();

  const examples = t("bento.vocabulary.examples") as string[];

  return (
    <section id="how-it-works" className="bg-[var(--muted)]/30 py-24 sm:py-32">
      <MaxWidthWrapper className="flex flex-col items-center gap-16 sm:gap-20">
        <div className="text-center">
          <Badge className="mb-4">{t("bento.badge")}</Badge>
          <Heading className="text-3xl sm:text-4xl">{t("bento.heading") as string}</Heading>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
          {/* Mobile Access - spans 2 rows */}
          <div className="relative lg:row-span-2">
            <div className="absolute inset-px rounded-lg bg-[var(--card)] lg:rounded-l-[2rem]" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg,0.5rem)+1px)] lg:rounded-l-[calc(2rem+1px)]">
              <div className="px-8 pb-3 pt-8 sm:px-10 sm:pb-0 sm:pt-10">
                <p className="mt-2 text-lg font-medium tracking-tight text-[var(--foreground)] max-lg:text-center">
                  {t("bento.mobile.title")}
                </p>
                <p className="mt-2 max-w-lg text-sm text-[var(--muted-foreground)] max-lg:text-center">
                  {t("bento.mobile.description")}
                </p>
              </div>
              <div className="relative flex min-h-[20rem] w-full flex-1 items-center justify-center p-8">
                <div className="relative h-full w-48 overflow-hidden rounded-[2rem] border-4 border-[var(--foreground)]/20 bg-[var(--background)] shadow-2xl">
                  <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
                    <Smartphone className="h-12 w-12 text-primary-700 dark:text-primary-400" />
                    <p className="text-center text-sm font-medium text-[var(--foreground)]">
                      {t("bento.mobile.comingSoon")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg shadow ring-1 ring-[var(--border)] lg:rounded-l-[2rem]" />
          </div>

          {/* Medical Vocabulary */}
          <div className="relative max-lg:row-start-1">
            <div className="absolute inset-px rounded-lg bg-[var(--card)] max-lg:rounded-t-[2rem]" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg,0.5rem)+1px)] max-lg:rounded-t-[calc(2rem+1px)]">
              <div className="px-8 pt-8 sm:px-10 sm:pt-10">
                <p className="mt-2 text-lg font-medium tracking-tight text-[var(--foreground)] max-lg:text-center">
                  {t("bento.vocabulary.title")}
                </p>
                <p className="mt-2 max-w-lg text-sm text-[var(--muted-foreground)] max-lg:text-center">
                  {t("bento.vocabulary.description")}
                </p>
              </div>
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="grid grid-cols-2 gap-2">
                  {examples.map((ex: string) => (
                    <div
                      key={ex}
                      className="rounded-lg bg-primary-100 px-3 py-2 text-xs font-medium text-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                    >
                      {ex}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg shadow ring-1 ring-[var(--border)] max-lg:rounded-t-[2rem]" />
          </div>

          {/* Consultation History */}
          <div className="relative max-lg:row-start-3 lg:col-start-2 lg:row-start-2">
            <div className="absolute inset-px rounded-lg bg-[var(--card)]" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg,0.5rem)+1px)]">
              <div className="px-8 pt-8 sm:px-10 sm:pt-10">
                <p className="mt-2 text-lg font-medium tracking-tight text-[var(--foreground)] max-lg:text-center">
                  {t("bento.progress.title")}
                </p>
                <p className="mt-2 max-w-lg text-sm text-[var(--muted-foreground)] max-lg:text-center">
                  {t("bento.progress.description")}
                </p>
              </div>
              <div className="flex flex-1 items-center justify-center p-8">
                <TrendingUp className="h-16 w-16 text-secondary-500" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg shadow ring-1 ring-[var(--border)]" />
          </div>

          {/* AI Assistant - spans 2 rows */}
          <div className="relative lg:row-span-2">
            <div className="absolute inset-px rounded-lg bg-[var(--card)] max-lg:rounded-b-[2rem] lg:rounded-r-[2rem]" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg,0.5rem)+1px)] max-lg:rounded-b-[calc(2rem+1px)] lg:rounded-r-[calc(2rem+1px)]">
              <div className="px-8 pb-3 pt-8 sm:px-10 sm:pb-0 sm:pt-10">
                <p className="mt-2 text-lg font-medium tracking-tight text-[var(--foreground)] max-lg:text-center">
                  {t("bento.assistant.title")}
                </p>
                <p className="mt-2 max-w-lg text-sm text-[var(--muted-foreground)] max-lg:text-center">
                  {t("bento.assistant.description")}
                </p>
              </div>
              <div className="relative flex-1 p-8">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 shadow-lg">
                  <div className="mb-4 flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary-700 dark:text-primary-400" />
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {t("bento.assistant.aiLabel")}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-lg bg-[var(--muted)] p-3">
                      <p className="text-xs text-[var(--muted-foreground)]">{t("bento.assistant.youLabel")}</p>
                      <p className="text-sm text-[var(--foreground)]">{t("bento.assistant.youSample")}</p>
                    </div>
                    <div className="rounded-lg bg-primary-100 p-3 dark:bg-primary-900/30">
                      <p className="text-xs text-primary-700 dark:text-primary-400">{t("bento.assistant.aiLabel")}</p>
                      <p className="text-sm text-[var(--foreground)]">{t("bento.assistant.aiSample")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg shadow ring-1 ring-[var(--border)] max-lg:rounded-b-[2rem] lg:rounded-r-[2rem]" />
          </div>
        </div>
      </MaxWidthWrapper>
    </section>
  );
}
