/**
 * Contrast-safe palette generation (pure function; the CLI is
 * scripts/generate-palette.mjs, the randomized proof is scripts/test-palette.mjs).
 *
 * TWO SOURCES OF RULES — keep them distinct:
 *
 *  A. From the agency's `webflow-prelaunch-colors` skill (do not re-derive;
 *     "-25 / +25 / -21" are the skill's 20-30 ranges made explicit): main, main-dark, main-light, main-soft, main-o50,
 *     main-soft-o50, cta, cta-hover.
 *        main-dark   HSL lightness -20..30   (we use -25, floor 5 so a dark
 *                    brand color can't go to pure black — matches the real
 *                    reference palette, whose main-dark is L5)
 *        main-light  HSL lightness +20..30   (we use +25)
 *        main-soft   desaturate ~40%, lightness +15
 *        *-o50       the solid hex + "80" (8-digit hex, 50% alpha)
 *        cta-hover   the "cta_dark" rule: lightness -20..30 (we use -21, floor 5)
 *
 *  B. The Template V2.55 additions to the Base collection — ALSO in the skill
 *     (Steps 3A / 3B / 6 / 7, updated 2026-09-21). KEEP THE TWO IN SYNC: a rule
 *     changed here must be changed there, and vice-versa. Colors: text,
 *     text-muted, solid-bg, base-bg, alt-bg — plus the contrast guarantee
 *     that makes every generated palette pass scripts/lib/palette.mjs RULES.
 *        text        fixed #333333 (overridable)
 *        solid-bg    brand hue, saturation ~0.56 x main's (12-28%), L 96
 *        base-bg     same hue, L 93, at 48% alpha  (opaque twin of solid-bg)
 *        alt-bg      brand hue, saturation 0.9 x main's, L ~21, at 80% alpha
 *        text-muted  brand hue, saturation ~0.37 x main's (10-20%), the
 *                    LIGHTEST lightness that still clears 4.6:1 on white,
 *                    solid-bg and base-bg (so it stays visibly lighter than text)
 *     Neutral brands (saturation < 8%) stay neutral — no invented tint.
 *
 * Contrast adjustments (lightness only; hue and saturation are preserved):
 *   main       darkened until white-on-main AND main on white / solid-bg /
 *              base-bg all reach 4.5:1 (headings & links sit on all of them)
 *   main-light kept <= main + 25 but darkened until it reaches 4.5:1 on the
 *              same light surfaces
 *   cta        nudged darker until white button text reaches 4.5:1; if that
 *              needs more than an 8-point shift, the button text switches to
 *              --main-dark instead (and cta-hover goes lighter)
 */
import { hexToRgba, rgbToHex, rgbToHsl, hslToRgb, over, contrast, luminance, evaluate } from "./palette.mjs";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const STEP = 0.1; // lightness search step: small = minimal, brand-faithful nudges
const NEUTRAL = 8; // below this saturation a brand is treated as neutral gray

export const isSolidHex = (v) => { const c = hexToRgba(v ?? ""); return !!c && c[3] === 1; };
export const normHex = (v) => rgbToHex(hexToRgba(v));

/**
 * @param {{main: string, cta: string, text?: string}} input solid hex colors
 * @param {Map<string,string>} baseTokens current tokens.css (Tier 2/3 mappings such as --heading → --main)
 * @returns {{tier1: Record<string,string>, tier2: Record<string,string>, notes: string[], result: ReturnType<typeof evaluate>}}
 */
export function generatePalette({ main: mainIn, cta: ctaIn, text: textIn = "#333333" }, baseTokens) {
  const notes = [];
  const mainInput = normHex(mainIn), ctaInput = normHex(ctaIn), textHex = normHex(textIn);

  const hex = (h, s, l) => rgbToHex(hslToRgb([h, clamp(s, 0, 100), clamp(l, 0, 100)]));
  const rgb = (v) => hexToRgba(v).slice(0, 3);
  const ratio = (fg, bg) => contrast(rgb(fg), rgb(bg));
  const tint = (s, factor, lo, hi) => (s < NEUTRAL ? s : clamp(s * factor, lo, hi));

  const [H, S, L] = rgbToHsl(rgb(mainInput));

  // ---- soft backgrounds first: main must be dark enough to sit ON them ----
  const bgS = tint(S, 0.56, 12, 28);
  const solidBg = hex(H, bgS, 96);
  const baseBgSolid = hex(H, bgS * 0.92, 93);
  const baseBg = baseBgSolid + "7a"; // 48% alpha
  // Translucent surfaces are measured as the EXACT composite over white (unrounded), the same way
  // scripts/lib/palette.mjs evaluates them — rounding the composite to hex first can differ by ~0.01:1
  // and produce a palette the checker then rejects.
  const baseBgOnWhite = over(hexToRgba(baseBg), [255, 255, 255]).slice(0, 3);
  const lightSurfaces = [[255, 255, 255], rgb(solidBg), baseBgOnWhite];
  const worstOnLight = (c) => Math.min(...lightSurfaces.map((bg) => contrast(rgb(c), bg)));

  // ---- main family (skill rules + contrast) ----
  let mainL = L;
  while (worstOnLight(hex(H, S, mainL)) < 4.5 && mainL > 1) mainL -= STEP;
  const main = mainL === L ? mainInput : hex(H, S, mainL);
  if (main !== mainInput) notes.push(`main darkened ${mainInput} → ${main} (headings/links/white-on-main must reach 4.5:1 on white and the soft backgrounds)`);

  const mainDark = hex(H, S, Math.max(mainL - 25, 5));

  let lightL = clamp(mainL + 25, 0, 85);
  while (worstOnLight(hex(H, S, lightL)) < 4.5 && lightL > mainL) lightL -= STEP;
  const mainLight = hex(H, S, lightL);
  if (lightL - mainL < 3) notes.push("main-light is barely lighter than main — main is already near the AA limit for text on light surfaces");

  const mainSoft = hex(H, S * 0.6, clamp(mainL + 15, 0, 70));

  // ---- alt-bg (needs white text over it, worst case over white) ----
  const altS = S * 0.9;
  let altL = 21;
  const ALT_ALPHA = 0xcc / 255; // must equal the alpha of the "cc" suffix below
  while (contrast([255, 255, 255], over([...rgb(hex(H, altS, altL)), ALT_ALPHA], [255, 255, 255])) < 4.5 && altL > 2) altL -= STEP;
  const altBg = hex(H, altS, altL) + "cc"; // 80% alpha

  // ---- text + muted ----
  const mutedS = tint(S, 0.37, 10, 20);
  let mutedL = 62;
  while (worstOnLight(hex(H, mutedS, mutedL)) < 4.6 && mutedL > 5) mutedL -= STEP;
  const textMuted = hex(H, mutedS, mutedL);
  if (luminance(rgb(textMuted)) <= luminance(rgb(textHex))) notes.push(`text-muted is not lighter than text ${textHex} — choose a lighter --text`);
  else if (ratio(textHex, "#ffffff") - ratio(textMuted, "#ffffff") < 1.5) notes.push(`text ${textHex} and muted differ by < 1.5:1 — the hierarchy will be subtle`);
  if (worstOnLight(textHex) < 4.5) notes.push(`--text ${textHex} itself fails AA on light surfaces — choose a darker --text`);

  // ---- cta ----
  const [cH, cS, cL] = rgbToHsl(rgb(ctaInput));
  const adjust = (dir, against) => {
    let l = cL;
    // Bound the search in the direction of travel only (a near-white accent starts at L=100 and must be free to move down).
    while (ratio(against, hex(cH, cS, l)) < 4.5 && (dir < 0 ? l > 1 : l < 99)) l += dir * STEP;
    return l;
  };
  let cta = ctaInput, onCta = "white";
  if (ratio("#ffffff", ctaInput) < 4.5) {
    const darkL = adjust(-1, "#ffffff");
    const darkDelta = cL - darkL;
    if (darkDelta <= 8) {
      cta = hex(cH, cS, darkL);
      notes.push(`cta darkened ${ctaInput} → ${cta} (white button text must reach 4.5:1; lightness only, hue/saturation kept)`);
    } else if (ratio(mainDark, ctaInput) >= 4.5) {
      onCta = "main-dark";
      notes.push(`cta ${ctaInput} is too light for white text (would need a ${darkDelta.toFixed(0)}-point darkening) — button text set to --main-dark instead`);
    } else {
      const lightL = adjust(+1, mainDark);
      if (lightL - cL < darkDelta) {
        cta = hex(cH, cS, lightL); onCta = "main-dark";
        notes.push(`cta lightened ${ctaInput} → ${cta} with --main-dark button text (smaller shift than darkening for white text)`);
      } else {
        cta = hex(cH, cS, darkL);
        notes.push(`cta darkened ${ctaInput} → ${cta} (${darkDelta.toFixed(0)} lightness points — large; consider a different accent)`);
      }
    }
  }
  const ctaL = rgbToHsl(rgb(cta))[2];
  const ctaHover = onCta === "white" ? hex(cH, cS, Math.max(ctaL - 21, 5)) : hex(cH, cS, Math.min(ctaL + 10, 95));

  const tier1 = {
    "--white": "#ffffff",
    "--text": textHex,
    "--text-muted": textMuted,
    "--light-grey": "#d1d1d1",
    "--solid-bg": solidBg,
    "--base-bg": baseBg,
    "--alt-bg": altBg,
    "--main": main,
    "--main-dark": mainDark,
    "--main-light": mainLight,
    "--main-soft": mainSoft,
    "--cta": cta,
    "--cta-hover": ctaHover,
    "--white-o85": "#ffffffd9",
    "--main-o50": main + "80",
    "--main-soft-o50": mainSoft + "80",
    "--overlay-color": "#00000080",
    "--shadow": "#0000001a",
  };
  const tier2 = { "--on-cta": onCta === "white" ? "var(--white)" : "var(--main-dark)" };

  const merged = new Map([...baseTokens, ...Object.entries(tier1), ...Object.entries(tier2)]);
  return { tier1, tier2, notes, result: evaluate(merged), hue: H, saturation: S };
}
