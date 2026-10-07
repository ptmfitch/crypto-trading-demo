import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function tagCount(source: string, tag: string) {
  return [...source.matchAll(new RegExp(`<${tag}\\b`, "g"))].length;
}

describe("auth headings and main", () => {
  it("renders Welcome Back as the only h1 inside one main", () => {
    const source = read("src/app/(auth)/login/login-form.tsx");
    assert.equal(tagCount(source, "main"), 1);
    assert.equal(tagCount(source, "h1"), 1);
    assert.match(source, /<h1\b[^>]*>\s*Welcome Back\s*<\/h1>/);
    assert.doesNotMatch(source, /CardTitle/);
    assert.doesNotMatch(source, /autocomplete=/);
  });

  it("renders Create an Account as the only h1 inside one main", () => {
    const source = read("src/app/(auth)/register/page.tsx");
    assert.equal(tagCount(source, "main"), 1);
    assert.equal(tagCount(source, "h1"), 1);
    assert.match(source, /<h1\b[^>]*>\s*Create an Account\s*<\/h1>/);
    assert.doesNotMatch(source, /CardTitle/);
    assert.doesNotMatch(source, /autocomplete=/);
  });

  it("gives the landing page one main around its heading", () => {
    const source = read("src/app/page.tsx");
    assert.equal(tagCount(source, "main"), 1);
    assert.equal(tagCount(source, "h1"), 1);
    assert.match(source, /Welcome to TradeSim/);
  });
});

describe("one main on protected pages", () => {
  it("keeps the header banner and a single main in the protected layout", () => {
    const source = read("src/app/(protected)/layout.tsx");
    assert.equal(tagCount(source, "main"), 1);
    assert.equal(tagCount(source, "header"), 0);
    assert.match(read("src/components/Header.tsx"), /<header\b/);
  });

  it("does not add a second main on the dashboard", () => {
    const source = read("src/app/(protected)/dashboard/page.tsx");
    assert.equal(tagCount(source, "main"), 0);
    assert.equal(tagCount(source, "h1"), 1);
  });

  it("does not add a second main on the profile", () => {
    const source = read("src/app/(protected)/profile/page.tsx");
    assert.equal(tagCount(source, "main"), 0);
    assert.equal(tagCount(source, "h1"), 1);
    assert.match(source, /Performance Report/);
  });
});

describe("buy and sell tab markup", () => {
  it("points both tabs at the order panel", () => {
    const source = read(
      "src/app/(protected)/dashboard/_components/TradeForm.tsx"
    );
    const controls = [...source.matchAll(/aria-controls="([^"]+)"/g)].map(
      (match) => match[1]
    );
    assert.deepEqual(controls, ["trade-order-panel", "trade-order-panel"]);
    assert.equal([...source.matchAll(/id="trade-order-panel"/g)].length, 1);
    assert.match(source, /id="trade-tab-buy"/);
    assert.match(source, /id="trade-tab-sell"/);
    assert.match(source, /role="tabpanel"/);
    assert.match(
      source,
      /aria-labelledby=\{\s*tradeType === "BUY" \? "trade-tab-buy" : "trade-tab-sell"\s*\}/
    );
    assert.match(
      source,
      /<label className="text-sm font-medium">You Pay<\/label>/
    );
    assert.match(
      source,
      /<label className="text-sm font-medium">You Receive<\/label>/
    );
    assert.doesNotMatch(source, /autocomplete=/);
  });
});
