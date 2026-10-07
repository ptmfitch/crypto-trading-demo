export const LOCALES = ["en", "sv"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "locale";

export function parseLocale(value: string | undefined | null): Locale {
  if (value === "sv") return "sv";
  return "en";
}

export function localeToDateLocale(locale: Locale): string {
  return locale === "sv" ? "sv-SE" : "en-US";
}
