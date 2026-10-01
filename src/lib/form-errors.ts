import { z } from "zod";

export const AMOUNT_REQUIRED_ERROR = "Amount must be greater than 0";

export const INSUFFICIENT_USDT_BALANCE = "Insufficient USDT balance.";

export const INSUFFICIENT_BTC_BALANCE = "Insufficient BTC balance.";

export const LOGIN_FAILED_ERROR =
  "Login Failed. Please check your email and password.";

export const tradeAmountSchema = z.object({
  amount: z.coerce.number().positive({ message: AMOUNT_REQUIRED_ERROR }),
});

export function balanceFieldError(message: string | undefined): string | null {
  if (
    message === INSUFFICIENT_USDT_BALANCE ||
    message === INSUFFICIENT_BTC_BALANCE
  ) {
    return message;
  }
  return null;
}

export function youReceiveAccessibleName(asset: "USDT" | "BTC"): string {
  return `You Receive ${asset}`;
}
