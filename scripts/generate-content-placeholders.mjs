#!/usr/bin/env node
/**
 * One-off generator for the placeholder CONTENT images every Skeleton fork
 * needs to exercise the image pipeline before real client photos exist —
 * distinct from scripts/generate-placeholder-assets.mjs, which covers
 * site-level meta assets (favicon, OG image). Run:
 *   node scripts/generate-content-placeholders.mjs
 * (not part of `verify` — these are checked-in files, not build output.)
 *
 * Same visual language as the favicon/OG placeholders (flat gray shapes,
 * no brand color, no photography) so every placeholder in the repo reads
 * as one deliberate system, not a chaotic mix. Two kinds:
 *   - avatar-generic — a person-silhouette, for doctor/staff headshots
 *     (a photo-shaped placeholder would look like a fabricated stock photo;
 *     a silhouette reads immediately and honestly as "no photo yet")
 *   - banner/icon/thumbnail-generic — the paw mark at three aspect ratios,
 *     for anything else: hero/page-header banners, service icons, blog/
 *     content-block thumbnails
 *
 * These are checked in and REUSED across many content entries (e.g. one
 * avatar-generic.png for all 6 example doctors/staff) rather than one
 * unique file per entry — confirmed working end-to-end first (content
 * collections' image() schema resolves a relative path outside its own
 * folder, and it goes through the normal astro:assets optimization). That
 * also signals "placeholder, replace me" more clearly than subtly-different
 * placeholders would.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const GRAY = "#9CA3AF";
const BG = "#F1F5F9";

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

/** Generic "no photo" person silhouette — head circle + shoulders ellipse, cropped at the frame's bottom edge. */
function avatarSvg({ width, height, fill, background }) {
  const cx = width / 2;
  const headR = width * 0.225;
  const headCy = height * 0.36;
  const shouldersRy = height * 0.34;
  const shouldersCy = height * 1.06; // pushed past the bottom edge so only the top arc shows, like a real headshot crop
  const bg = background ? `<rect width="${width}" height="${height}" fill="${background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><clipPath id="frame"><rect width="${width}" height="${height}"/></clipPath><g clip-path="url(#frame)">${bg}<circle cx="${cx}" cy="${headCy}" r="${headR}" fill="${fill}"/><ellipse cx="${cx}" cy="${shouldersCy}" rx="${width * 0.42}" ry="${shouldersRy}" fill="${fill}"/></g></svg>`;
}

async function rasterize(svg, width, height, outPath) {
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(outPath);
}

mkdirSync("src/assets", { recursive: true });

// Doctor/staff headshots — 4:5, a safe middle ground that crops sensibly
// under both the 1:1 card and 3:4 detail-page treatments (see DoctorCard/
// StaffCard vs. doctors|staff/[slug].astro's own aspect-ratio CSS).
await rasterize(avatarSvg({ width: 800, height: 1000, fill: GRAY, background: BG }), 800, 1000, "src/assets/avatar-generic.png");

// Wide banner — Hero / PageHeaderBanner / a service's pageHeaderImage.
await rasterize(pawSvg({ markSize: 480, canvasWidth: 1920, canvasHeight: 1080, fill: GRAY, background: BG }), 1920, 1080, "src/assets/banner-generic.png");

// Small icon — rendered at ~3.5rem with object-fit:contain on a WHITE card
// (ServiceCard), so no background rect — transparent, mark only.
await rasterize(pawSvg({ markSize: 512, fill: GRAY }), 512, 512, "src/assets/icon-generic.png");

// 16:9 — blog postThumbnail and a service's contentBlocks[].image.
await rasterize(pawSvg({ markSize: 260, canvasWidth: 800, canvasHeight: 450, fill: GRAY, background: BG }), 800, 450, "src/assets/thumbnail-generic.png");

console.log("Wrote: src/assets/{avatar,banner,icon,thumbnail}-generic.png");
