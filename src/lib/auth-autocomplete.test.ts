import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function fieldBlock(source: string, fieldName: string): string {
  const marker = `name="${fieldName}"`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing FormField name="${fieldName}"`);
  const nextField = source.indexOf("<FormField", start + marker.length);
  return source.slice(start, nextField === -1 ? undefined : nextField);
}

function autoComplete(block: string): string {
  const match = block.match(/autoComplete="([^"]+)"/);
  assert.ok(match, "expected an autoComplete attribute");
  return match[1];
}

describe("register autocomplete", () => {
  const source = readFileSync("src/app/(auth)/register/page.tsx", "utf8");

  it("sets name, email, and new-password", () => {
    assert.equal(autoComplete(fieldBlock(source, "name")), "name");
    assert.equal(autoComplete(fieldBlock(source, "email")), "email");
    assert.equal(autoComplete(fieldBlock(source, "password")), "new-password");
  });
});

describe("login autocomplete", () => {
  const source = readFileSync("src/app/(auth)/login/login-form.tsx", "utf8");

  it("sets username and current-password", () => {
    assert.equal(autoComplete(fieldBlock(source, "email")), "username");
    assert.equal(autoComplete(fieldBlock(source, "password")), "current-password");
  });

  it("leaves the email field empty", () => {
    assert.match(source, /defaultValues:\s*\{\s*email:\s*""\s*,\s*password:\s*""\s*\}/);
  });
});
