#!/usr/bin/env node
/**
 * Design-token contract checker. Run: `npm run check:tokens`.
 *
 * Enforces the rules in src/styles/tokens.css and AGENTS.md:
 *   1. every var(--x) must be defined (tokens.css, or a custom property
 *      assigned somewhere in src — e.g. --reveal-delay set by motion.ts)
 *   2. no inline fallbacks:  var(--x, #fff)  is an error (single source of truth)
 *   3. no literal colors (#hex, rgb()/hsl()/..., named colors) in component CSS
 *   4. no literal durations / cubic-beziers in transition/animation
 *   5. the palette itself passes contrast rules (text, muted text, headings,
 *      buttons, footer, focus ring) — computed from the actual hex values
 * Exits 1 on any error. Warnings are advisory only.
 */
import fs from "node:fs";
import path from "node:path";
import { evaluate } from "./lib/palette.mjs";

const SRC = "src";
const TOKENS_FILE = path.join(SRC, "styles", "tokens.css");
// Third-party / generated CSS that legitimately contains literals.
const SKIP_FILES = new Set([TOKENS_FILE, path.join(SRC, "styles", "icon-font.css")].map((p) => path.normalize(p)));
const SKIP_DIRS = new Set([path.join(SRC, "content")].map((p) => path.normalize(p)));

const errors = [];
const warnings = [];

// ---------- tokens.css ----------
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
const tokensSrc = stripComments(fs.readFileSync(TOKENS_FILE, "utf8"));
const tokens = new Map();
for (const m of tokensSrc.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) tokens.set(m[1], m[2].trim());

// ---------- collect source files ----------
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(path.normalize(p))) walk(p); }
    else if (/\.(astro|css)$/.test(e.name) && !SKIP_FILES.has(path.normalize(p))) files.push(p);
  }
})(SRC);

/** CSS regions of a file as {text, line} — <style> blocks and style="" attrs in .astro, whole file in .css */
function cssRegions(file) {
  const src = fs.readFileSync(file, "utf8");
  if (file.endsWith(".css")) return [{ text: stripComments(src), line: 1 }];
  const regions = [];
  const lineAt = (idx) => src.slice(0, idx).split("\n").length;
  for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    regions.push({ text: stripComments(m[1]), line: lineAt(m.index + m[0].indexOf(m[1])) });
  }
  for (const m of src.matchAll(/\sstyle="([^"]*)"/g)) regions.push({ text: m[1], line: lineAt(m.index) });
  return regions;
}

// Custom properties assigned anywhere in src count as "defined" (component-local vars).
const assigned = new Set(tokens.keys());
const regionsByFile = new Map(files.map((f) => [f, cssRegions(f)]));
for (const regions of regionsByFile.values())
  for (const r of regions) for (const m of r.text.matchAll(/(--[a-z0-9-]+)\s*:/g)) assigned.add(m[1]);
// ...and vars assigned from JS (element.style.setProperty("--x", ...)) in .astro scripts.
for (const f of files.filter((x) => x.endsWith(".astro")))
  for (const m of fs.readFileSync(f, "utf8").matchAll(/setProperty\(\s*["'](--[a-z0-9-]+)["']/g)) assigned.add(m[1]);

// ---------- rules 1-4 ----------
const COLOR_PROP = /^(color|background(-color|-image)?|border(-[a-z]+)*|outline(-color)?|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration(-color)?|--[a-z0-9-]+)$/;
const NAMED = /\b(white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|navy|teal|maroon|olive|lime|aqua|fuchsia|brown|gold)\b/i;
const COLOR_FN = /\b(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/i;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const used = new Set();

function balancedVars(text) {
  const out = [];
  let i = 0;
  while ((i = text.indexOf("var(", i)) !== -1) {
    let depth = 0, j = i + 3;
    for (; j < text.length; j++) {
      if (text[j] === "(") depth++;
      else if (text[j] === ")" && --depth === 0) break;
    }
    out.push({ start: i, inner: text.slice(i + 4, j) });
    i = j + 1;
  }
  return out;
}

for (const [file, regions] of regionsByFile) {
  for (const r of regions) {
    const lineOf = (idx) => r.line + r.text.slice(0, idx).split("\n").length - 1;
    // 1 + 2: var() references
    for (const v of balancedVars(r.text)) {
      const comma = v.inner.indexOf(",");
      const name = (comma === -1 ? v.inner : v.inner.slice(0, comma)).trim();
      used.add(name);
      if (comma !== -1) errors.push(`${file}:${lineOf(v.start)}  inline fallback var(${name}, …) — remove the fallback; the value belongs in tokens.css`);
      if (!assigned.has(name)) errors.push(`${file}:${lineOf(v.start)}  undefined token ${name} — add it to src/styles/tokens.css (or fix the typo)`);
    }
    // 3 + 4: declarations
    for (const d of r.text.matchAll(/(^|[;{\s])(--[a-z0-9-]+|[a-z-]+)\s*:\s*([^;{}]+)/g)) {
      const prop = d[2];
      // strip url(...) and var(...) so paths / token names can't trip the literal checks
      const value = d[3].replace(/\b0(?:\.01)?ms\b/g, "").replace(/url\([^)]*\)/g, "").replace(/var\([^()]*(\([^()]*\)[^()]*)*\)/g, "");
      const line = lineOf(d.index);
      if (COLOR_PROP.test(prop) && (HEX.test(value) || COLOR_FN.test(value) || NAMED.test(value)))
        errors.push(`${file}:${line}  literal color in "${prop}: ${d[3].trim().slice(0, 60)}" — use a token from tokens.css`);
      if (/^(transition|animation)(-duration|-delay|-timing-function)?$/.test(prop)) {
        if (/(^|[^\w-])\d*\.?\d+m?s\b/.test(value) || /cubic-bezier\(/.test(value))
          errors.push(`${file}:${line}  literal timing in "${prop}: ${d[3].trim().slice(0, 60)}" — use --motion-duration-* / --motion-ease*`);
      }
    }
  }
}

// ---------- rule 5: palette contrast (rules + math live in lib/palette.mjs, shared with generate-palette) ----------
const contrastResult = evaluate(tokens);
const rows = contrastResult.rows;
errors.push(...contrastResult.errors);
warnings.push(...contrastResult.warnings);

// ---------- report ----------
const defined = [...tokens.keys()];
const referencedByTokens = new Set([...tokens.values()].flatMap((v) => [...v.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1])));
const unused = defined.filter((n) => !used.has(n) && !referencedByTokens.has(n));

console.log(`tokens: ${defined.length} defined · ${files.length} source files scanned\n`);
console.log("Palette contrast:");
rows.forEach((r) => console.log("  " + r));
if (unused.length) console.log(`\nInfo — defined but not referenced by any component (${unused.length}): ${unused.join(", ")}`);
if (warnings.length) { console.log(`\n${warnings.length} warning(s):`); warnings.forEach((w) => console.log("  ⚠ " + w)); }
if (errors.length) { console.log(`\n${errors.length} ERROR(S):`); errors.forEach((e) => console.log("  ✖ " + e)); process.exit(1); }
console.log("\n✔ token contract holds");
