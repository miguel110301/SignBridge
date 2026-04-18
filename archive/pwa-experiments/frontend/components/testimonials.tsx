"use client";

import { Star } from "lucide-react";
import { MaxWidthWrapper } from "./max-width-wrapper";
import { Heading } from "./heading";
import { Badge } from "./badge";
import { useI18n } from "./i18n-provider";

interface TestimonialItem {
  quote: string;
  name: string;
  role: string;
  initials: string;
  avatar: number;
}

export function Testimonials() {
  const { t } = useI18n();

  const items = t("testimonials.items") as unknown as TestimonialItem[];

  return (
    <section id="testimonials" className="py-24 sm:py-32">
      <MaxWidthWrapper className="flex flex-col items-center gap-16 sm:gap-20">
        <div className="text-center">
          <Badge className="mb-4">{t("testimonials.badge")}</Badge>
          <Heading className="text-3xl sm:text-4xl">{t("testimonials.title") as string}</Heading>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-2">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-4 rounded-2xl bg-[var(--card)] p-6 shadow-sm ring-1 ring-[var(--border)] sm:p-8"
            >
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="flex-1 text-pretty text-[var(--foreground)]">&ldquo;{item.quote}&rdquo;</p>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
                  {item.initials}
                </div>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{item.name}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </MaxWidthWrapper>
    </section>
  );
}
