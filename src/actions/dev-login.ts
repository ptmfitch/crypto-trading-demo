"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { parseLocale } from "@/i18n/config";
import { setLocaleCookie } from "@/i18n/locale-cookie";
import { isDevLoginEnabled } from "@/lib/dev-login";
import prisma from "@/lib/prisma";

export type DevLoginErrorCode =
  | "devLoginOff"
  | "testAccountNotFound"
  | "authSecretMissing"
  | "devSignInFailed";

export async function signInAsTestAccount(email: string) {
  if (!isDevLoginEnabled()) {
    return { error: "devLoginOff" as DevLoginErrorCode };
  }

  const account = await prisma.user.findUnique({
    where: { email },
    select: { email: true, locale: true },
  });
  if (!account) {
    return { error: "testAccountNotFound" as DevLoginErrorCode };
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return { error: "authSecretMissing" as DevLoginErrorCode };
  }

  const locale = parseLocale(account.locale);
  await setLocaleCookie(locale);

  try {
    await signIn("credentials", {
      email: account.email,
      devLoginToken: secret,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "devSignInFailed" as DevLoginErrorCode };
    }
    throw error;
  }
}
