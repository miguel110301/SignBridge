"use client";

import { Hand } from "lucide-react";
import { useI18n } from "./i18n-provider";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-800">
                <Hand className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-[var(--foreground)]">
                Sign<span className="text-primary-700 dark:text-primary-400">Bridge</span>
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-[var(--muted-foreground)]">
              {t("footer.description")}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
              {t("footer.product")}
            </h4>
            <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
              <li><a href="#features" className="hover:text-[var(--foreground)]">{t("footer.links.features")}</a></li>
              <li><a href="#" className="hover:text-[var(--foreground)]">{t("footer.links.pricing")}</a></li>
              <li><a href="#" className="hover:text-[var(--foreground)]">{t("footer.links.demo")}</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
              {t("footer.company")}
            </h4>
            <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
              <li><a href="#" className="hover:text-[var(--foreground)]">{t("footer.companyLinks.about")}</a></li>
              <li><a href="#" className="hover:text-[var(--foreground)]">{t("footer.companyLinks.contact")}</a></li>
              <li><a href="#" className="hover:text-[var(--foreground)]">{t("footer.companyLinks.blog")}</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-[var(--border)] pt-6 text-center text-sm text-[var(--muted-foreground)]">
          © {new Date().getFullYear()} SignBridge. {t("footer.rights")}
        </div>
      </div>
    </footer>
  );
}
