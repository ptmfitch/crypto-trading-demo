import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function blockContaining(source: string, token: string, selector: string) {
  const pattern = new RegExp(`${selector}\\s*\\{([^}]*)\\}`, "g");
  for (const match of source.matchAll(pattern)) {
    if (match[1].includes(token)) return match[1];
  }
  throw new Error(`No ${selector} block contains ${token}`);
}

function tokenValue(block: string, name: string) {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+)`));
  if (!match) throw new Error(`Missing --${name}`);
  return match[1].trim();
}

function oklchToSrgb(value: string) {
  const match = value.match(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/
  );
  if (!match) throw new Error(`Not an oklch color: ${value}`);
  const L = Number(match[1]);
  const C = Number(match[2]);
  const H = (Number(match[3]) * Math.PI) / 180;
  const alphaToken = match[4];
  const alpha = alphaToken
    ? alphaToken.endsWith("%")
      ? Number(alphaToken.slice(0, -1)) / 100
      : Number(alphaToken)
    : 1;
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const linear = [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => Math.min(1, Math.max(0, channel)));
  return { linear, alpha };
}

function luminance(linear: number[]) {
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground: string, background: string) {
  const fg = oklchToSrgb(foreground);
  const bg = oklchToSrgb(background);
  const blended = fg.linear.map(
    (channel, index) => channel * fg.alpha + bg.linear[index] * (1 - fg.alpha)
  );
  const lighter = Math.max(luminance(blended), luminance(bg.linear));
  const darker = Math.min(luminance(blended), luminance(bg.linear));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("resting input border contrast", () => {
  const light = blockContaining(css, "--input:", ":root");
  const dark = blockContaining(css, "--input:", "\\.dark");

  it("clears 3:1 against the card in the light theme", () => {
    const ratio = contrast(tokenValue(light, "input"), tokenValue(light, "card"));
    assert.ok(ratio >= 3, `light input border is ${ratio.toFixed(2)}:1`);
  });

  it("clears 3:1 against the card in the dark theme", () => {
    const ratio = contrast(tokenValue(dark, "input"), tokenValue(dark, "card"));
    assert.ok(ratio >= 3, `dark input border is ${ratio.toFixed(2)}:1`);
  });
});

describe("theme menu reduced motion", () => {
  it("drops the dropdown entrance animation", () => {
    const rule = css.match(
      /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}/
    );
    assert.ok(rule, "missing prefers-reduced-motion rule");
    assert.match(rule[0], /\[data-slot="dropdown-menu-content"\]/);
    assert.match(rule[0], /animation:\s*none/);
  });
});
