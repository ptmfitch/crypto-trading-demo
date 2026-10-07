import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidLocaleCookie,
  LOCALE_COOKIE_MAX_AGE,
  parseLocale,
} from "./config.ts";
import { en } from "./en.ts";
import { sv } from "./sv.ts";
import { t } from "./translate.ts";

function leafPaths(
  value: Record<string, unknown>,
  prefix = ""
): string[] {
  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") {
      paths.push(path);
    } else if (child && typeof child === "object") {
      paths.push(...leafPaths(child as Record<string, unknown>, path));
    }
  }
  return paths;
}

describe("dictionary", () => {
  it("has matching keys in English and Swedish", () => {
    const enPaths = leafPaths(en).sort();
    const svPaths = leafPaths(sv).sort();
    assert.deepEqual(svPaths, enPaths);
  });

  it("has no empty leaf strings", () => {
    for (const path of leafPaths(en)) {
      assert.notEqual(t(en, path), "");
    }
    for (const path of leafPaths(sv)) {
      assert.notEqual(t(sv, path), "");
    }
  });

  it("parseLocale falls back to en", () => {
    assert.equal(parseLocale(undefined), "en");
    assert.equal(parseLocale(null), "en");
    assert.equal(parseLocale(""), "en");
    assert.equal(parseLocale("fr"), "en");
    assert.equal(parseLocale("sv"), "sv");
  });

  it("isValidLocaleCookie accepts only en and sv", () => {
    assert.equal(isValidLocaleCookie("en"), true);
    assert.equal(isValidLocaleCookie("sv"), true);
    assert.equal(isValidLocaleCookie(undefined), false);
    assert.equal(isValidLocaleCookie(""), false);
    assert.equal(isValidLocaleCookie("fr"), false);
  });

  it("locale cookie maxAge matches 30-day session default", () => {
    assert.equal(LOCALE_COOKIE_MAX_AGE, 30 * 24 * 60 * 60);
  });

  it("interpolates known placeholders and leaves unknown ones", () => {
    assert.equal(
      t(en, "dashboard.welcomeBack", { name: "Anna" }),
      "Welcome Back, Anna!"
    );
    assert.equal(
      t(en, "dashboard.welcomeBack", { other: "x" }),
      "Welcome Back, {name}!"
    );
  });
});
