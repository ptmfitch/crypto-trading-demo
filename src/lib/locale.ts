import type { PrismaClient } from "@prisma/client";

export const LOCALES = ["en"] as const;

export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
};

export function isAppLocale(value: unknown): value is AppLocale {
  return (
    typeof value === "string" &&
    (LOCALES as readonly string[]).includes(value)
  );
}

export class UnsupportedLocaleError extends Error {
  constructor() {
    super("Unsupported locale");
    this.name = "UnsupportedLocaleError";
  }
}

export async function readUserLocale(
  db: PrismaClient,
  userId: string
): Promise<AppLocale> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });
  if (!user || !isAppLocale(user.locale)) return DEFAULT_LOCALE;
  return user.locale;
}

export async function saveUserLocale(
  db: PrismaClient,
  userId: string,
  locale: string
): Promise<AppLocale> {
  if (!isAppLocale(locale)) {
    throw new UnsupportedLocaleError();
  }
  const user = await db.user.update({
    where: { id: userId },
    data: { locale },
    select: { locale: true },
  });
  if (!isAppLocale(user.locale)) {
    throw new UnsupportedLocaleError();
  }
  return user.locale;
}
