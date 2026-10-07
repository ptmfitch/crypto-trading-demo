import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  isValidLocaleCookie,
  LOCALE_COOKIE,
  parseLocale,
  type Locale,
} from "./config";
import { en, type Messages } from "./en";
import { sv } from "./sv";

const dictionaries: Record<Locale, Messages> = { en, sv };

export async function getDictionary(): Promise<{
  locale: Locale;
  messages: Messages;
}> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;

  if (isValidLocaleCookie(cookieValue)) {
    return {
      locale: cookieValue,
      messages: dictionaries[cookieValue],
    };
  }

  const session = await auth();
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { locale: true },
    });
    const locale = parseLocale(user?.locale);
    // Cookie writes throw during render. Login and locale actions persist the cookie.
    return { locale, messages: dictionaries[locale] };
  }

  return {
    locale: DEFAULT_LOCALE,
    messages: dictionaries[DEFAULT_LOCALE],
  };
}

export function getDictionaryForLocale(locale: Locale): Messages {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}
