import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  contrastRatio,
  DARK_CARD,
  DARK_LOSS,
  DARK_PROFIT,
  LIGHT_CARD,
  LIGHT_ERROR_TOAST_BG,
  LIGHT_LOSS,
  LIGHT_PROFIT,
  LIGHT_SUCCESS_TOAST_BG,
} from "./a11y-contrast.ts";

function declaration(css: string, selector: string, property: string) {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, selector);
  const slice = css.slice(start, css.indexOf("}", start));
  const match = slice.match(new RegExp(`${property}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `${selector} ${property}`);
  return match[1].toLowerCase();
}

describe("light theme profit and loss contrast", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  it("uses the light colors that clear 4.5:1 on white and on toast fills", () => {
    assert.equal(declaration(css, ":root {", "--profit"), LIGHT_PROFIT);
    assert.equal(declaration(css, ":root {", "--loss"), LIGHT_LOSS);
    assert.ok(contrastRatio(LIGHT_PROFIT, LIGHT_CARD) >= 4.5);
    assert.ok(contrastRatio(LIGHT_LOSS, LIGHT_CARD) >= 4.5);
    assert.ok(contrastRatio(LIGHT_PROFIT, LIGHT_SUCCESS_TOAST_BG) >= 4.5);
    assert.ok(contrastRatio(LIGHT_LOSS, LIGHT_ERROR_TOAST_BG) >= 4.5);
  });

  it("keeps the dark colors that already clear 4.5:1 on the dark card", () => {
    assert.equal(declaration(css, ".dark {", "--profit"), DARK_PROFIT);
    assert.equal(declaration(css, ".dark {", "--loss"), DARK_LOSS);
    assert.ok(contrastRatio(DARK_PROFIT, DARK_CARD) >= 4.5);
    assert.ok(contrastRatio(DARK_LOSS, DARK_CARD) >= 4.5);
  });
});
