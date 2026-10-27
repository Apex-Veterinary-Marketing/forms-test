#!/usr/bin/env node
/**
 * Randomized proof that the palette generator is contrast-safe.
 * Run: `npm run test:palette` (also part of `npm run verify`).
 *
 * Generates palettes from thousands of pseudo-random brand colors (a fixed
 * seed, so failures are reproducible) plus a set of awkward hand-picked ones,
 * and requires EVERY generated palette to pass every contrast rule in
 * scripts/lib/palette.mjs. If someone edits the rules or the generator and
 * breaks the "passes by construction" guarantee, this fails.
 */
import fs from "node:fs";
import { readTokens, hslToHex } from "./lib/palette.mjs";
import { generatePalette } from "./lib/generate.mjs";

const COUNT = 3000;
const baseTokens = readTokens(fs.readFileSync("src/styles/tokens.css", "utf8"));

// mulberry32: tiny seeded PRNG so any failure can be reproduced exactly
let seed = 20260921;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const randomColor = () => hslToHex([rand() * 360, rand() < 0.1 ? rand() * 6 : rand() * 100, 2 + rand() * 96]);

const awkward = [
  ["#16253c", "#008585"], // the reference palette
  ["#8c3f63", "#f28157"], ["#026873", "#f2a057"], ["#f2c94c", "#f2a057"], ["#ddeeff", "#ffcc00"],
  ["#808080", "#808080"], ["#000000", "#ff0000"], ["#ffffff", "#ffffff"], ["#ffff00", "#ffff00"],
  ["#0000ff", "#00ffff"], ["#ff00ff", "#00ff00"], ["#010101", "#fefefe"], ["#fefefe", "#010101"],
];
const cases = [...awkward.map(([main, cta]) => ({ main, cta })), ...Array.from({ length: COUNT }, () => ({ main: randomColor(), cta: randomColor() }))];
const texts = ["#333333", "#333333", "#333333", "#222222", "#444444"]; // mostly the default, some variation

const failures = [];
const stats = { whiteCta: 0, darkCta: 0, ctaNudged: 0, mainDarkened: 0, maxCtaShift: 0 };
for (const c of cases) {
  const text = pick(texts);
  const { result, notes, tier2 } = generatePalette({ ...c, text }, baseTokens);
  if (result.errors.length) failures.push({ ...c, text, errors: result.errors });
  tier2["--on-cta"] === "var(--white)" ? stats.whiteCta++ : stats.darkCta++;
  if (notes.some((n) => n.startsWith("cta darkened") || n.startsWith("cta lightened"))) stats.ctaNudged++;
  if (notes.some((n) => n.startsWith("main darkened"))) stats.mainDarkened++;
}

console.log(`${cases.length} generated palettes (${awkward.length} hand-picked awkward + ${COUNT} random, seed 20260921)`);
console.log(`  button text white: ${stats.whiteCta} · switched to --main-dark: ${stats.darkCta} · cta nudged for contrast: ${stats.ctaNudged} · main darkened: ${stats.mainDarkened}`);
if (failures.length) {
  console.log(`\n✖ ${failures.length} palette(s) failed the contrast rules. First few:`);
  for (const f of failures.slice(0, 5)) console.log(`  main ${f.main} cta ${f.cta} text ${f.text}\n    ` + f.errors.join("\n    "));
  process.exit(1);
}
console.log("✔ every generated palette passes every contrast rule");
