import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";

import {
  readUserLocale,
  saveUserLocale,
  UnsupportedLocaleError,
} from "./locale.ts";

const root = join(import.meta.dirname, "../..");

describe("user locale", () => {
  let dir = "";
  let prisma: PrismaClient;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "tradesim-locale-"));
    const databaseUrl = `file:${join(dir, "dev.db")}`;
    execFileSync(
      join(root, "node_modules/.bin/prisma"),
      ["db", "push", "--skip-generate"],
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "pipe",
      }
    );
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  });

  after(async () => {
    await prisma?.$disconnect();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("saves a locale and reads it back for that user only", async () => {
    const swedish = await prisma.user.create({
      data: { email: "sv@example.com", name: "Svea" },
    });
    const danish = await prisma.user.create({
      data: { email: "da@example.com", name: "Dane" },
    });

    assert.equal(await readUserLocale(prisma, swedish.id), "en");
    assert.equal(await saveUserLocale(prisma, swedish.id, "sv"), "sv");
    assert.equal(await saveUserLocale(prisma, danish.id, "da"), "da");
    assert.equal(await readUserLocale(prisma, swedish.id), "sv");
    assert.equal(await readUserLocale(prisma, danish.id), "da");

    const stored = await prisma.user.findUnique({
      where: { id: swedish.id },
      select: { locale: true },
    });
    assert.equal(stored?.locale, "sv");
  });

  it("rejects an unsupported locale without changing the saved value", async () => {
    const user = await prisma.user.create({
      data: { email: "nb@example.com", name: "Nora", locale: "nb" },
    });

    await assert.rejects(
      () => saveUserLocale(prisma, user.id, "fi"),
      UnsupportedLocaleError
    );
    assert.equal(await readUserLocale(prisma, user.id), "nb");
  });

  it("falls back to English when the stored locale is not supported", async () => {
    const user = await prisma.user.create({
      data: { email: "xx@example.com", name: "Unknown" },
    });
    await prisma.$executeRaw`UPDATE "User" SET "locale" = 'xx' WHERE "id" = ${user.id}`;
    assert.equal(await readUserLocale(prisma, user.id), "en");
    assert.equal(await readUserLocale(prisma, "missing-user"), "en");
  });
});
