"use server";

import { registerUser as register } from "@/lib/register-user";

export async function registerUser(
  values: Parameters<typeof register>[0],
) {
  return register(values);
}
