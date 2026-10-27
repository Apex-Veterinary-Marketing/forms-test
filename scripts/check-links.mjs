#!/usr/bin/env node
/**
 * Internal link/asset checker. Run AFTER a build: `npm run check:links`
 * (or as part of `npm run verify`).
 *
 * Walks every .html file in dist/ and confirms each root-relative href/src
 * (/services/dental-care, /images/x.png, …) resolves to a file in dist/.
 * External URLs, mailto:, tel:, data: and #anchors are ignored.
 *
 * Also checks that every tel: link on the site dials ONE number — the one
 * phoneHref() produces (site.callTrackingNumber, else site.phoneNumber). A
 * second number means a link was built by hand and skips call tracking.
 *
 * And that dist/sitemap.xml lists exactly the indexable pages: every built page
 * that isn't noindex, a redirect or the 404 page is in it, and nothing else is.
 * Exits 1 if anything is broken.
 */
import fs from "node:fs";
import path from "node:path";

const dist = process.argv[2] || "dist";
if (!fs.existsSync(dist)) {
  console.error(`✖ ${dist}/ not found — run \`npm run build\` first.`);
  process.exit(1);
}

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith(".html")) files.push(p);
  }
})(dist);

const resolves = (url) => {
  const clean = url.split("#")[0].split("?")[0];
  if (!clean || clean === "/") return true;
  const rel = clean.replace(/^\//, "");
  return [rel, `${rel}/index.html`, `${rel}.html`].some((candidate) => fs.existsSync(path.join(dist, candidate)));
};

const broken = new Map();
const telNumbers = new Map(); // number → pages
let checked = 0;
for (const file of files) {
  const page = "/" + path.relative(dist, file).split(path.sep).join("/").replace(/index\.html$/, "");
  const html = fs.readFileSync(file, "utf8");
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = match[1];
    if (url.startsWith("tel:")) {
      const num = url.slice(4);
      if (!telNumbers.has(num)) telNumbers.set(num, new Set());
      telNumbers.get(num).add(page);
    }
    if (/^(mailto:|tel:|data:|javascript:|#|https?:\/\/|\/\/)/.test(url) || !url.startsWith("/")) continue;
    checked++;
    if (!resolves(url)) {
      if (!broken.has(url)) broken.set(url, new Set());
      broken.get(url).add(page);
    }
  }
}

console.log(`${files.length} pages, ${checked} internal references checked`);
let failed = false;
if (telNumbers.size > 1) {
  failed = true;
  console.log(`✖ tel: links dial ${telNumbers.size} different numbers — build every call link with phoneHref() (src/lib/utils/phone.ts):`);
  for (const [num, pages] of telNumbers) {
    const list = [...pages];
    console.log(`  ${num}  ←  ${list.slice(0, 4).join(", ")}${list.length > 4 ? ` (+${list.length - 4} more)` : ""}`);
  }
} else if (telNumbers.size === 1) {
  console.log(`✔ every tel: link dials ${[...telNumbers.keys()][0]}`);
}
if (broken.size === 0) {
  console.log("✔ no broken internal links or assets");
} else {
  console.log(`✖ ${broken.size} broken reference(s):`);
  for (const [url, pages] of broken) {
    const list = [...pages];
    console.log(`  ${url}  ←  ${list.slice(0, 4).join(", ")}${list.length > 4 ? ` (+${list.length - 4} more)` : ""}`);
  }
  failed = true;
}
// ---- sitemap.xml ↔ built pages ----
const sitemapFile = path.join(dist, "sitemap.xml");
if (!fs.existsSync(sitemapFile)) {
  console.log("✖ dist/sitemap.xml is missing (singleSitemap in astro.config.mjs should write it on every build)");
  failed = true;
} else {
  const inSitemap = new Set(
    [...fs.readFileSync(sitemapFile, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/\/$/, "") || "/")
  );
  const indexable = new Set();
  for (const file of files) {
    const rel = "/" + path.relative(dist, file).split(path.sep).join("/");
    if (rel === "/404.html") continue;
    const html = fs.readFileSync(file, "utf8");
    if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
    if (/http-equiv="refresh"/i.test(html) && html.length < 2000) continue;
    indexable.add(rel.replace(/\/?index\.html$/, "").replace(/\.html$/, "") || "/");
  }
  const missing = [...indexable].filter((p) => !inSitemap.has(p));
  const extra = [...inSitemap].filter((p) => !indexable.has(p));
  if (missing.length || extra.length) {
    failed = true;
    if (missing.length) console.log(`✖ ${missing.length} indexable page(s) missing from sitemap.xml: ${missing.slice(0, 8).join(", ")}`);
    if (extra.length) console.log(`✖ sitemap.xml lists ${extra.length} page(s) that are noindex, redirects or not built: ${extra.slice(0, 8).join(", ")}`);
  } else {
    console.log(`✔ sitemap.xml lists all ${inSitemap.size} indexable pages`);
  }
}

if (failed) process.exit(1);
