import { auth } from "@/auth";
import {
  DEFAULT_LOCALE,
  isAppLocale,
  readUserLocale,
  type AppLocale,
} from "@/lib/locale";
import prisma from "@/lib/prisma";
import { getRequestConfig } from "next-intl/server";
import da from "../../messages/da.json";
import en from "../../messages/en.json";
import sv from "../../messages/sv.json";

const catalogs = { en, sv, da } satisfies Record<AppLocale, typeof en>;

// Guests stay on English. After login the user row wins, including when
// the browser has no leftover cookies from the previous session.
async function resolveLocale(): Promise<AppLocale> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return DEFAULT_LOCALE;
  return readUserLocale(prisma, userId);
}

export default getRequestConfig(async ({ locale }) => {
  const resolved = isAppLocale(locale) ? locale : await resolveLocale();
  return {
    locale: resolved,
    messages: catalogs[resolved],
    timeZone: "UTC",
  };
});
