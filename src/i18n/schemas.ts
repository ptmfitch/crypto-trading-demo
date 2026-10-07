import { z } from "zod";
import type { Messages } from "./en";

export function createLoginSchema(messages: Messages) {
  return z.object({
    email: z.string().email(messages.auth.invalidEmail),
    password: z.string().min(1, messages.auth.passwordRequired),
  });
}

export function createRegisterSchema(messages: Messages) {
  return z.object({
    name: z.string().min(2, messages.auth.nameMinLength),
    email: z.string().email(messages.auth.invalidEmail),
    password: z.string().min(6, messages.auth.passwordMinLength),
  });
}

export function createRegisterActionSchema(messages: Messages) {
  return z.object({
    name: z.string().min(2, messages.auth.nameMinLengthShort),
    email: z.string().email(messages.auth.invalidEmailAddress),
    password: z.string().min(6, messages.auth.passwordMinLengthShort),
  });
}

export function createTradeSchema(messages: Messages) {
  return z.object({
    amount: z.coerce
      .number()
      .positive({ message: messages.trade.amountGreaterThanZero }),
  });
}
