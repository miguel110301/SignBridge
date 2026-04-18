import es from "./es.json";
import en from "./en.json";

export type Locale = "es" | "en";

const translations: Record<Locale, Record<string, unknown>> = { es, en };

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function getTranslations(locale: Locale) {
  const dict = translations[locale];

  return function t(key: string, params?: Record<string, string | number>): string | string[] {
    const value = getNestedValue(dict, key);

    if (Array.isArray(value)) {
      return value as string[];
    }

    if (typeof value !== "string") {
      return key;
    }

    if (!params) return value;

    return Object.entries(params).reduce<string>(
      (str, [k, v]) => str.replace(`{${k}}`, String(v)),
      value
    );
  };
}

export { translations };
