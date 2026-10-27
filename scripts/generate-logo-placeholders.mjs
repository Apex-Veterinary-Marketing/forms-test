#!/usr/bin/env node
/**
 * Placeholder logo pair for site.logoWhite/logoColor (Header's crossfade —
 * see that component's own header comment). Run:
 *   node scripts/generate-logo-placeholders.mjs
 *
 * Unlike every other placeholder in this repo, these are pure SVG written
 * straight to public/ and rendered by the VIEWER'S OWN BROWSER via a plain
 * <img src>, not pre-rasterized by sharp — so, unlike the favicon/OG/content
 * placeholders (deliberately text-free: sharp's SVG rasterizer depends on
 * whatever fonts happen to be installed on the machine that runs the
 * generator, which isn't portable), a browser always has some default
 * sans-serif to fall back to, so a short wordmark here is safe and much
 * more obviously "this is a logo" than the bare mark alone.
 */
import { writeFileSync } from "node:fs";

const paw = (fill) => {
  const s = 40; // mark box size
  const cx = s / 2;
  const padCy = s * 0.64, padRx = s * 0.235, padRy = s * 0.1875;
  const toeRx = s * 0.094, toeRy = s * 0.125;
  const toeCy = s * 0.3, spread = s * 0.19;
  const toes = [-1.5, -0.5, 0.5, 1.5]
    .map((i) => `<ellipse cx="${cx + i * spread}" cy="${toeCy + Math.abs(i) * s * 0.05}" rx="${toeRx}" ry="${toeRy}" fill="${fill}"/>`)
    .join("");
  return `<ellipse cx="${cx}" cy="${padCy}" rx="${padRx}" ry="${padRy}" fill="${fill}"/>${toes}`;
};

function logoSvg(fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="40" viewBox="0 0 220 40">
  <g>${paw(fill)}</g>
  <text x="52" y="27" font-family="system-ui, sans-serif" font-size="19" font-weight="700" fill="${fill}">PRACTICE NAME</text>
</svg>
`;
}

writeFileSync("public/logo-color.svg", logoSvg("#6B7280")); // dark-gray text/mark, for the white (post-scroll) header state
writeFileSync("public/logo-white.svg", logoSvg("#FFFFFF")); // white text/mark, for the transparent (pre-scroll) header state

console.log("Wrote: public/logo-color.svg, public/logo-white.svg");
