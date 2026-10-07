import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, parseLocale, type Locale } from "./config";
import { en, type Messages } from "./en";
import { sv } from "./sv";

const dictionaries: Record<Locale, Messages> = { en, sv };

export async function getDictionary(): Promise<{
  locale: Locale;
  messages: Messages;
}> {
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value ?? null);
  return { locale, messages: dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE] };
}

export function getDictionaryForLocale(locale: Locale): Messages {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}
