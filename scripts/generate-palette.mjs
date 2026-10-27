#!/usr/bin/env node
/**
 * Contrast-safe palette generator. Run:
 *
 *   npm run palette -- --main "#16253c" --cta "#008585"            # print only
 *   npm run palette -- --main "#16253c" --cta "#008585" --write    # update tokens.css
 *
 * Input: the client's two brand colors (from the logo). Output: the whole
 * Tier 1 "Base" variable collection. Shade rules for main/cta are the agency's
 * webflow-prelaunch-colors skill; the additions (text, text-muted, solid-bg,
 * base-bg, alt-bg) and the contrast guarantee live in scripts/lib/generate.mjs.
 * The result is validated with the SAME rules `npm run check:tokens` enforces.
 *
 * Optional: --text "#333333"   body text (default #333333)
 */
import fs from "node:fs";
import { readTokens } from "./lib/palette.mjs";
import { generatePalette, isSolidHex } from "./lib/generate.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : fallback;
};
const need = (name, value) => {
  if (!isSolidHex(value)) {
    console.error(`✖ --${name} must be a solid hex color like "#16253c" (got ${value ?? "nothing"})`);
    process.exit(2);
  }
  return value;
};
const main = need("main", arg("main"));
const cta = need("cta", arg("cta"));
const text = need("text", arg("text", "#333333"));

const TOKENS_FILE = "src/styles/tokens.css";
const css = fs.readFileSync(TOKENS_FILE, "utf8");
const { tier1, tier2, notes, result, hue, saturation } = generatePalette({ main, cta, text }, readTokens(css));

console.log(`Palette for main ${main} / cta ${cta}   (brand hue ${hue.toFixed(0)}°, saturation ${saturation.toFixed(0)}%)\n`);
console.log("Tier 1 — paste into src/styles/tokens.css (or re-run with --write):");
for (const [k, v] of Object.entries(tier1)) console.log(`  ${k}: ${v};`);
console.log(`\nTier 2 override:\n  --on-cta: ${tier2["--on-cta"]};`);
if (notes.length) {
  console.log("\nAdjusted for contrast / flagged:");
  notes.forEach((n) => console.log("  • " + n));
}
console.log("\nContrast check (same rules as `npm run check:tokens`):");
result.rows.forEach((r) => console.log("  " + r));
result.warnings.forEach((w) => console.log("  ⚠ " + w));
if (result.errors.length) {
  console.log("\n✖ The generated palette still fails:");
  result.errors.forEach((e) => console.log("  ✖ " + e));
  process.exit(1);
}

if (args.includes("--write")) {
  let out = css;
  for (const [name, value] of Object.entries({ ...tier1, ...tier2 })) {
    const declaration = new RegExp(`^(\\s*${name}\\s*:\\s*)[^;]+(;)`, "m");
    if (!declaration.test(out)) {
      console.error(`✖ couldn't find "${name}:" in ${TOKENS_FILE}`);
      process.exit(1);
    }
    out = out.replace(declaration, `$1${value}$2`);
  }
  fs.writeFileSync(TOKENS_FILE, out);
  console.log(`\n✔ wrote ${Object.keys(tier1).length + 1} values to ${TOKENS_FILE} — now run \`npm run check:tokens\``);
} else {
  console.log("\n(dry run — add --write to update src/styles/tokens.css)");
}
