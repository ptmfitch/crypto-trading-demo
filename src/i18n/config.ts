export const LOCALES = ["en", "sv"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "locale";

/** Matches NextAuth default session maxAge when auth.ts does not set one. */
export const LOCALE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export function parseLocale(value: string | undefined | null): Locale {
  if (value === "sv") return "sv";
  return "en";
}

export function isValidLocaleCookie(
  value: string | undefined
): value is Locale {
  return value === "en" || value === "sv";
}

export function localeToDateLocale(locale: Locale): string {
  return locale === "sv" ? "sv-SE" : "en-US";
}
