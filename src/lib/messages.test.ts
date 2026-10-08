import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createTranslator } from "use-intl/core";

import { TRADE_PAUSED_ERROR } from "./btc-quote.ts";

const locales = ["en"] as const;

function load(locale: (typeof locales)[number]) {
  const file = new URL(`../../messages/${locale}.json`, import.meta.url);
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
}

function leafKeys(value: unknown, prefix = ""): string[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, nested]) =>
      leafKeys(nested, prefix ? `${prefix}.${key}` : key)
    );
  }
  return [prefix];
}

describe("message catalogs", () => {
  const catalogs = Object.fromEntries(locales.map((locale) => [locale, load(locale)]));

  it("gives every locale the English keys", () => {
    const english = leafKeys(catalogs.en).sort();
    for (const locale of locales) {
      assert.deepEqual(leafKeys(catalogs[locale]).sort(), english);
    }
  });

  it("keeps the English source copy used by the demo", () => {
    const t = createTranslator({
      locale: "en",
      messages: catalogs.en,
    });

    assert.equal(t("Metadata.title"), "Crypto Trading Simulator");
    assert.equal(t("Landing.title"), "Welcome to TradeSim");
    assert.equal(t("Landing.login"), "Login");
    assert.equal(t("Landing.createAccount"), "Create Account");
    assert.equal(t("Login.title"), "Welcome Back");
    assert.equal(t("Login.submit"), "Login");
    assert.equal(t("Login.noAccount"), "Don't have an account?");
    assert.equal(t("Register.title"), "Create an Account");
    assert.equal(t("Register.submit"), "Create Account");
    assert.equal(t("Header.dashboard"), "Dashboard");
    assert.equal(t("Header.profile"), "Profile");
    assert.equal(t("Header.logout"), "Logout");
    assert.equal(t("Dashboard.welcome", { name: "Ada" }), "Welcome Back, Ada!");
    assert.equal(
      t("Dashboard.subtitle"),
      "Here's your trading dashboard overview."
    );
    assert.equal(t("Dashboard.portfolio"), "Portfolio Value");
    assert.equal(t("Dashboard.pnl"), "Total P&L");
    assert.equal(t("Dashboard.btcPrice"), "Live BTC Price");
    assert.equal(t("Dashboard.trades"), "Total Trades");
    assert.equal(t("Quote.delayed"), "Price delayed");
    assert.equal(t("Quote.unavailable"), "Price unavailable");
    assert.equal(t("Trade.buy"), "Buy");
    assert.equal(t("Trade.sell"), "Sell");
    assert.equal(t("Trade.youPay"), "You Pay");
    assert.equal(t("Trade.buySubmit"), "BUY BTC");
    assert.equal(t("Trade.sellSubmit"), "SELL BTC");
    assert.equal(t("Trade.paused"), TRADE_PAUSED_ERROR);
    assert.equal(
      t("Trade.bought", { btc: "0.100000", usdt: "100.00" }),
      "Successfully bought 0.100000 BTC for $100.00"
    );
    assert.equal(t("Profile.title"), "Performance Report");
    assert.equal(t("Profile.history"), "Trade History");
    assert.equal(
      t("Profile.performanceDescription"),
      "Your portfolio's profit and loss over time."
    );
    assert.equal(
      t("Chart.change", {
        direction: "Increased",
        amount: "1.00",
        percent: "2.50",
      }),
      "Increased by $1.00 (2.50%)"
    );
  });
});
