#!/usr/bin/env node
/**
 * One-off generator for the placeholder favicon + Open Graph image every
 * Skeleton fork ships with. Run: `node scripts/generate-placeholder-assets.mjs --force`
 * (not part of `verify` — these are checked-in files, not build output;
 * re-run only if you want to regenerate them from scratch).
 *
 * Deliberately generic — a flat gray paw mark, no brand color, no text (SVG
 * text rendering isn't reliably font-independent across machines). These
 * MUST be replaced with the client's real logo/social image before launch;
 * see the comments where they're referenced in SeoHead.astro.
 *
 * Uses `sharp` to rasterize hand-written SVG — no new dependency: sharp is
 * already a transitive dependency of `astro` itself (astro:assets' default
 * image service), which this project already relies on for <Image>.
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";

// Overwrites public/favicon.*, apple-touch-icon.png and og-default.png. In a
// client fork those are the client's real files, so this refuses to run
// without --force.
if (!process.argv.includes("--force")) {
  console.error("This overwrites public/favicon.png, favicon.ico, apple-touch-icon.png and og-default.png.");
  console.error("Re-run with --force only in the template itself, never in a client fork.");
  process.exit(1);
}

const GRAY = "#9CA3AF"; // neutral, not a brand color — never tokens.css's --main
const BG = "#F1F5F9";

/**
 * A flat paw-print mark (one pad ellipse + 4 toe ellipses, all simple
 * shapes — no path data) of `markSize` units, centered on a
 * `canvasWidth` x `canvasHeight` canvas (defaults to a square the size of
 * the mark, i.e. no padding — pass an explicit canvas for a wide/OG crop).
 */
function pawSvg({ markSize, canvasWidth = markSize, canvasHeight = markSize, fill, background }) {
  const cx = markSize / 2;
  const padCy = markSize * 0.64, padRx = markSize * 0.235, padRy = markSize * 0.1875;
  const toeRx = markSize * 0.094, toeRy = markSize * 0.125;
  const toeCy = markSize * 0.3, spread = markSize * 0.19;
  const offsetX = (canvasWidth - markSize) / 2;
  const offsetY = (canvasHeight - markSize) / 2;
  const bg = background ? `<rect width="${canvasWidth}" height="${canvasHeight}" fill="${background}"/>` : "";
  const toes = [-1.5, -0.5, 0.5, 1.5]
    .map((i) => `<ellipse cx="${cx + i * spread}" cy="${toeCy + Math.abs(i) * markSize * 0.05}" rx="${toeRx}" ry="${toeRy}" fill="${fill}"/>`)
    .join("");
  const mark = `<g transform="translate(${offsetX}, ${offsetY})"><ellipse cx="${cx}" cy="${padCy}" rx="${padRx}" ry="${padRy}" fill="${fill}"/>${toes}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">${bg}${mark}</svg>`;
}

async function rasterize(svg, width, height, outPath) {
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(outPath);
}

// 1. PNG favicons. No favicon.svg on purpose: browsers prefer an SVG icon
// over PNGs, so a leftover placeholder SVG silently masked a client's real
// PNG favicon. Client files are almost always PNG — PNG is the primary icon.
await rasterize(pawSvg({ markSize: 64, fill: GRAY }), 32, 32, "public/favicon.png"); // 32x32, generic <link rel="icon">
await rasterize(pawSvg({ markSize: 140, canvasWidth: 180, canvasHeight: 180, fill: GRAY, background: "#ffffff" }), 180, 180, "public/apple-touch-icon.png"); // iOS wants padding + an opaque background, not edge-to-edge

// 3. favicon.ico — a "PNG-compressed ICO": a valid ICONDIR container wrapping
// one PNG image directly (supported since Windows Vista; every browser that
// still asks for .ico specifically accepts this). Avoids needing a real ICO
// encoder for a single-size placeholder.
const icoPng = await sharp(Buffer.from(pawSvg({ markSize: 64, fill: GRAY }))).resize(32, 32).png().toBuffer();
const icondir = Buffer.alloc(6);
icondir.writeUInt16LE(0, 0); // reserved
icondir.writeUInt16LE(1, 2); // type: icon
icondir.writeUInt16LE(1, 4); // 1 image
const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0); // width (0-255; 32 fits)
entry.writeUInt8(32, 1); // height
entry.writeUInt8(0, 2); // no palette
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(icoPng.length, 8); // image data size
entry.writeUInt32LE(6 + 16, 12); // offset of image data
writeFileSync("public/favicon.ico", Buffer.concat([icondir, entry, icoPng]));

// 4. Open Graph / Twitter default image, 1200x630 (the standard OG size) —
// the mark stays a modest size with real padding around it, not stretched
// or edge-bled to fill the wide canvas.
await rasterize(
  pawSvg({ markSize: 380, canvasWidth: 1200, canvasHeight: 630, fill: GRAY, background: BG }),
  1200,
  630,
  "public/og-default.png"
);

console.log("Wrote: public/favicon.png, favicon.ico, apple-touch-icon.png, og-default.png");
