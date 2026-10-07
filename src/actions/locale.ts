"use server";

import { auth } from "@/auth";
import { LOCALE_COOKIE, parseLocale, type Locale } from "@/i18n/config";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

async function setLocaleCookie(locale: Locale) {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
  });
}

export async function updateLocale(locale: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "notAuthenticated" as const };
  }

  const parsed = parseLocale(locale);
  if (parsed !== "en" && parsed !== "sv") {
    return { error: "invalidLocale" as const };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { locale: parsed },
  });

  await setLocaleCookie(parsed);
  revalidatePath("/", "layout");

  return { success: true as const };
}

export async function syncLocaleCookie() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "notAuthenticated" as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { locale: true },
  });

  const locale = parseLocale(user?.locale);
  await setLocaleCookie(locale);

  return { success: true as const, locale };
}
