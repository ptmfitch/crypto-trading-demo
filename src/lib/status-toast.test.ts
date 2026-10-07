import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { STATUS_TOAST_ID, statusToastOptions } from "./status-toast.ts";

function regionText(toast: { title: string; description?: string }) {
  return [toast.title, toast.description].filter(Boolean).join(" ");
}

describe("status toast", () => {
  it("reuses one id so the next status replaces the previous toast", () => {
    const error = statusToastOptions();
    const success = statusToastOptions();
    assert.equal(error.id, STATUS_TOAST_ID);
    assert.equal(success.id, error.id);
    assert.equal(
      Object.prototype.hasOwnProperty.call(success, "description"),
      true,
    );
    assert.equal(success.description, undefined);
  });

  it("drops the earlier error text when success has no description", () => {
    const previous = {
      id: "stale",
      type: "error",
      title: "Insufficient BTC balance.",
      description: "Insufficient BTC balance.",
    };
    const next = {
      ...previous,
      ...statusToastOptions(),
      type: "success" as const,
      title: "Successfully sold 0.000302 BTC for $25",
    };

    const region = regionText(next);
    assert.equal(next.id, STATUS_TOAST_ID);
    assert.equal(region, "Successfully sold 0.000302 BTC for $25");
    assert.equal(region.includes("Insufficient"), false);
  });

  it("keeps the description that belongs to the new status", () => {
    const previous = {
      title: "Registration Failed",
      description: "An account with this email already exists.",
    };
    const next = {
      ...previous,
      ...statusToastOptions("You can now log in with your credentials."),
      title: "Account Created",
    };

    assert.equal(
      regionText(next),
      "Account Created You can now log in with your credentials.",
    );
    assert.equal(regionText(next).includes("already exists"), false);
  });
});
