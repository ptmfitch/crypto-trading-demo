"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { saveUserLocale } from "@/lib/locale";
import { revalidatePath } from "next/cache";

export async function updateUserLocale(locale: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const };
  }

  try {
    await saveUserLocale(prisma, session.user.id, locale);
  } catch {
    return { ok: false as const };
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}
