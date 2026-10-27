/**
 * Shared color math + the palette contrast rules.
 *
 * Single source of truth used by BOTH:
 *   - scripts/check-tokens.mjs      (verifies the palette that's in tokens.css)
 *   - scripts/generate-palette.mjs  (builds a palette that satisfies these rules)
 * so the generator can never produce something the checker rejects.
 */

// ---------- color math ----------
/** "#rgb" | "#rrggbb" | "#rrggbbaa" → [r,g,b,a(0-1)], or null */
export function hexToRgba(v) {
  const h = String(v).trim().match(/^#([0-9a-f]{3,8})$/i);
  if (!h) return null;
  let x = h[1];
  if (x.length === 3 || x.length === 4) x = [...x].map((c) => c + c).join("");
  if (x.length !== 6 && x.length !== 8) return null;
  const n = (i) => parseInt(x.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), x.length === 8 ? n(6) / 255 : 1];
}
export const rgbToHex = ([r, g, b]) =>
  "#" + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");

/** [r,g,b] (0-255) → [h(0-360), s(0-100), l(0-100)] */
export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s * 100, l * 100];
}
/** [h(0-360), s(0-100), l(0-100)] → [r,g,b] (0-255, unrounded) */
export function hslToRgb([h, s, l]) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
export const hslToHex = (hsl) => rgbToHex(hslToRgb(hsl));

/** Composite a translucent [r,g,b,a] over an opaque [r,g,b] background. */
export const over = ([r, g, b, a], [br, bg, bb]) => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};
export const WHITE = [255, 255, 255, 1];

/** Resolve a token value (hex, "transparent", or a var(--x) chain) to [r,g,b,a]. tokens: Map<name, value>. */
export function resolveColor(tokens, value, depth = 0) {
  const v = String(value).trim();
  if (depth > 8) return null;
  const ref = v.match(/^var\((--[a-z0-9-]+)\)$/);
  if (ref) return tokens.has(ref[1]) ? resolveColor(tokens, tokens.get(ref[1]), depth + 1) : null;
  if (v === "transparent") return [0, 0, 0, 0];
  return hexToRgba(v);
}

/** Parse every "--name: value;" declaration out of CSS text (comments stripped) into a Map. */
export function readTokens(cssText) {
  const map = new Map();
  for (const m of cssText.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) map.set(m[1], m[2].trim());
  return map;
}

// ---------- the rules ----------
/**
 * [foreground token, background token, min ratio, "error"|"warn", note]
 * Translucent backgrounds are composited over white (the worst case for light
 * surfaces). Every text/background pairing the components actually use is here.
 */
export const RULES = [
  ["--text", "--white", 4.5, "error", "body text"],
  ["--text", "--solid-bg", 4.5, "error", "body text on soft bg"],
  ["--text", "--base-bg", 4.5, "error", "body text on translucent bg"],
  ["--text-muted", "--white", 4.5, "error", "muted text"],
  ["--text-muted", "--solid-bg", 4.5, "error", "muted text on soft bg"],
  ["--text-muted", "--base-bg", 4.5, "error", "muted text on translucent bg"],
  ["--heading", "--white", 4.5, "error", "headings"],
  ["--heading", "--solid-bg", 4.5, "error", "headings on soft bg"],
  ["--main", "--white", 4.5, "error", "links / secondary buttons on white"],
  ["--main", "--base-bg", 4.5, "error", "links / headings on translucent bg"],
  ["--main-light", "--white", 4.5, "error", "link hover / accent text on white"],
  ["--main-light", "--solid-bg", 4.5, "error", "link hover / accent text on soft bg"],
  ["--on-main", "--main", 4.5, "error", "text on primary"],
  ["--on-main", "--main-dark", 4.5, "error", "text on darkest brand"],
  ["--on-cta", "--cta", 4.5, "error", "CTA button text"],
  ["--on-cta", "--cta-hover", 4.5, "error", "CTA button text on hover"],
  ["--cta", "--white", 3, "warn", "CTA fill against a white page (advisory: the button label carries meaning)"],
  ["--footer-text", "--footer-bg", 4.5, "error", "footer body text"],
  ["--footer-heading", "--footer-bg", 4.5, "error", "footer headings"],
  ["--white", "--alt-bg", 4.5, "error", "white text on the translucent dark bg (worst case: over white)"],
  ["--focus-ring", "--white", 3, "error", "focus ring on white"],
  ["--focus-ring", "--solid-bg", 3, "error", "focus ring on soft bg"],
];

/**
 * Evaluate every rule against a token map.
 * @returns {{rows: string[], errors: string[], warnings: string[]}}
 */
export function evaluate(tokens) {
  const rows = [], errors = [], warnings = [];
  const color = (name) => resolveColor(tokens, `var(${name})`);
  for (const [fgN, bgN, min, level, note] of RULES) {
    const fg = color(fgN), bg = color(bgN);
    if (!fg || !bg) {
      errors.push(`${!fg ? fgN : bgN} isn't a resolvable hex color (contrast checks need #hex or var() chains to hex)`);
      continue;
    }
    const bgSolid = over(bg, WHITE);
    const r = contrast(over(fg, bgSolid), bgSolid);
    const ok = r >= min;
    rows.push(`${ok ? "pass" : level === "warn" ? "WARN" : "FAIL"}  ${r.toFixed(2).padStart(5)} (≥${min})  ${fgN} on ${bgN}  — ${note}`);
    if (!ok) (level === "warn" ? warnings : errors).push(`contrast ${r.toFixed(2)} < ${min}: ${fgN} on ${bgN} — ${note}`);
  }
  // Two-step text hierarchy: muted must be LIGHTER than body text (this was an inverted-hierarchy bug once).
  const [tx, mu] = [color("--text"), color("--text-muted")];
  if (tx && mu && luminance(mu) <= luminance(tx))
    errors.push(`--text-muted (${tokens.get("--text-muted")}) is not lighter than --text (${tokens.get("--text")}) — hierarchy inverted`);
  return { rows, errors, warnings };
}
