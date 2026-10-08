"use server";

import { AuthError } from "next-auth";
import { getTranslations } from "next-intl/server";
import { signIn } from "@/auth";
import { isDevLoginEnabled } from "@/lib/dev-login";
import prisma from "@/lib/prisma";

export async function signInAsTestAccount(email: string) {
  const t = await getTranslations("Login");
  if (!isDevLoginEnabled()) {
    return { error: t("devOff") };
  }

  const account = await prisma.user.findUnique({
    where: { email },
    select: { email: true },
  });
  if (!account) {
    return { error: t("devMissing") };
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return { error: t("devSecret") };
  }

  try {
    await signIn("credentials", {
      email: account.email,
      devLoginToken: secret,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: t("devFailed") };
    }
    throw error;
  }
}
