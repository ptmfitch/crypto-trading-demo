import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AMOUNT_REQUIRED_ERROR,
  balanceFieldError,
  INSUFFICIENT_BTC_BALANCE,
  INSUFFICIENT_USDT_BALANCE,
  LOGIN_FAILED_ERROR,
  tradeAmountSchema,
  youReceiveAccessibleName,
} from "./form-errors.ts";

function amountMessage(amount: unknown): string | undefined {
  const parsed = tradeAmountSchema.safeParse({ amount });
  if (parsed.success) return undefined;
  return parsed.error.issues[0]?.message;
}

describe("trade amount field", () => {
  it("rejects zero with the visible field error", () => {
    assert.equal(amountMessage(0), AMOUNT_REQUIRED_ERROR);
    assert.equal(amountMessage("0"), AMOUNT_REQUIRED_ERROR);
    assert.equal(amountMessage(""), AMOUNT_REQUIRED_ERROR);
  });

  it("rejects a negative amount with the same message", () => {
    assert.equal(amountMessage(-1), AMOUNT_REQUIRED_ERROR);
  });

  it("accepts a positive amount", () => {
    assert.equal(amountMessage(25), undefined);
    assert.equal(amountMessage("0.01"), undefined);
  });
});

describe("balance errors stay on the amount field", () => {
  it("keeps insufficient USDT and BTC sentences", () => {
    assert.equal(
      balanceFieldError(INSUFFICIENT_USDT_BALANCE),
      "Insufficient USDT balance."
    );
    assert.equal(
      balanceFieldError(INSUFFICIENT_BTC_BALANCE),
      "Insufficient BTC balance."
    );
  });

  it("leaves other trade failures as non-field errors", () => {
    assert.equal(balanceFieldError("Wallet not found."), null);
    assert.equal(balanceFieldError(undefined), null);
  });
});

describe("login failure on the password field", () => {
  it("names the failure and tells the user what to check", () => {
    assert.match(LOGIN_FAILED_ERROR, /Login Failed/);
    assert.match(LOGIN_FAILED_ERROR, /Please check your email and password\./);
  });
});

describe("you receive name", () => {
  it("includes the label and the asset", () => {
    assert.equal(youReceiveAccessibleName("BTC"), "You Receive BTC");
    assert.equal(youReceiveAccessibleName("USDT"), "You Receive USDT");
  });
});
