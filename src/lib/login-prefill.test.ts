import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loginEmailFromQuery, loginPathAfterRegister } from "./login-prefill.ts";

describe("login email after register", () => {
  it("puts the registered address on the login path and not the password", () => {
    const path = loginPathAfterRegister("ada+tag@example.com");
    const url = new URL(path, "http://localhost");

    assert.equal(url.pathname, "/login");
    assert.equal(url.searchParams.get("email"), "ada+tag@example.com");
    assert.equal(url.searchParams.has("password"), false);
    assert.equal(
      loginEmailFromQuery(url.searchParams.get("email") ?? undefined),
      "ada+tag@example.com",
    );
  });

  it("reads a single email query value", () => {
    assert.equal(
      loginEmailFromQuery("  ada@example.com  "),
      "ada@example.com",
    );
    assert.equal(loginEmailFromQuery(["ada@example.com"]), "ada@example.com");
  });

  it("leaves the field empty when the query is missing or not an email", () => {
    assert.equal(loginEmailFromQuery(undefined), "");
    assert.equal(loginEmailFromQuery(""), "");
    assert.equal(loginEmailFromQuery("not-an-email"), "");
    assert.equal(loginEmailFromQuery(["not-an-email", "ada@example.com"]), "");
  });
});
