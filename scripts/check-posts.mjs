#!/usr/bin/env node
/**
 * Blog post contract checker — `npm run check:posts` (part of `verify`, and run by
 * .github/workflows/check-posts.yml on every push to main that touches posts).
 *
 * 1. Structure: the storage every automation writes to is identical in every
 *    Skeleton site and must stay so — posts in src/content/blog/, images in
 *    src/assets/blog/, the `blog` collection loading "*.{md,mdx}" from that
 *    folder, and every contract field present in its schema. A site may ADD
 *    optional fields; removing or renaming one fails here.
 * 2. Posts: validates every src/content/blog/*.md against
 *    docs/BLOG-POST-CONTRACT.md: file name = slug, required frontmatter, dates,
 *    image paths that exist, category and author ids that exist, source URLs,
 *    and a non-empty body. Automated posts are checked like hand-written ones.
 * Exits 1 on any ✖. `astro build` re-validates the schema itself.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const yaml = createRequire(import.meta.url)("js-yaml");
const BLOG = "src/content/blog";
const errors = [], warnings = [];
const ids = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(md|mdx|json)$/.test(f)).map((f) => f.replace(/\.(md|mdx|json)$/, "")) : []);
const categories = new Set(ids("src/content/blog-categories"));
const doctors = new Set(ids("src/content/doctors"));
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ---- 1. Structure (identical in every site; see docs/BLOG-POST-CONTRACT.md) ----
const CONTRACT_FIELDS = [
  "name", "pubDate", "draft", "titleTag", "metaDescription", "postSummary", "postThumbnail",
  "thumbnailAlt", "author", "authorName", "category", "readTime", "keyTakeaways", "sources", "featured",
];
for (const dir of [BLOG, "src/assets/blog", "src/content/blog-categories"]) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) errors.push(`${dir}/ is missing — blog storage must be identical in every site (docs/BLOG-POST-CONTRACT.md)`);
}
const config = fs.existsSync("src/content.config.ts") ? fs.readFileSync("src/content.config.ts", "utf8").replace(/\r\n/g, "\n") : "";
const blogStart = config.indexOf("const blog = defineCollection(");
if (blogStart < 0) {
  errors.push("src/content.config.ts: the `blog` collection (const blog = defineCollection(…)) is missing or renamed");
} else {
  const block = config.slice(blogStart, config.indexOf("\n});", blogStart) + 4);
  if (!/glob\(\{\s*pattern:\s*"\*\.\{md,mdx\}",\s*base:\s*"\.\/src\/content\/blog"\s*\}\)/.test(block))
    errors.push('src/content.config.ts: the blog loader must be glob({ pattern: "*.{md,mdx}", base: "./src/content/blog" })');
  const missing = CONTRACT_FIELDS.filter((f) => !new RegExp(`^\\s+${f}:`, "m").test(block));
  if (missing.length) errors.push(`src/content.config.ts: blog schema is missing contract field(s): ${missing.join(", ")} — sites may add fields, never remove or rename them`);
}

// ---- 2. Posts ----
// .gitkeep keeps the folder in git while a site has no posts yet.
const files = fs.existsSync(BLOG) ? fs.readdirSync(BLOG).filter((f) => f !== ".gitkeep") : [];
for (const f of files) {
  const file = `${BLOG}/${f}`;
  if (fs.statSync(file).isDirectory()) { errors.push(`${file}: sub-folders aren't allowed — posts sit directly in ${BLOG}/`); continue; }
  if (!/\.mdx?$/.test(f)) { errors.push(`${file}: only .md posts belong here (images go in src/assets/blog/)`); continue; }
  const slug = f.replace(/\.mdx?$/, "");
  const err = (m) => errors.push(`${file}: ${m}`);
  const warn = (m) => warnings.push(`${file}: ${m}`);
  if (!SLUG.test(slug)) err(`file name must be the slug: lowercase letters, digits and single hyphens (got "${slug}")`);

  const src = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) { err("must start with a --- frontmatter block --- "); continue; }
  let d;
  try { d = yaml.load(m[1]) || {}; } catch (e) { err(`frontmatter isn't valid YAML: ${e.message.split("\n")[0]}`); continue; }
  const body = m[2].trim();

  if (!d.name || typeof d.name !== "string") err("name (the title) is required");
  const rawDate = m[1].match(/^pubDate:\s*["']?([^"'\s#]+)/m)?.[1];
  if (!rawDate) err("pubDate is required (YYYY-MM-DD)");
  else if (!DATE.test(rawDate) || Number.isNaN(Date.parse(rawDate))) err(`pubDate must be YYYY-MM-DD (got "${rawDate}")`);
  if (d.draft !== undefined && typeof d.draft !== "boolean") err("draft must be true or false");
  if (d.featured !== undefined && typeof d.featured !== "boolean") err("featured must be true or false");

  if (d.postThumbnail) {
    const p = String(d.postThumbnail);
    if (!p.startsWith("../../assets/blog/")) err(`postThumbnail must point into src/assets/blog/ as "../../assets/blog/<file>" (got "${p}")`);
    else if (!fs.existsSync(path.join(BLOG, p))) err(`postThumbnail file not found: src/assets/blog/${path.basename(p)}`);
    else if (!/\.(jpe?g|png|webp|avif)$/i.test(p)) err("postThumbnail must be .jpg, .png, .webp or .avif");
    if (!d.thumbnailAlt) warn("thumbnailAlt is missing (describe the image)");
  } else warn("no postThumbnail — the post falls back to the site's default share image");

  for (const c of [].concat(d.category || [])) if (!categories.has(c)) err(`category "${c}" doesn't exist in src/content/blog-categories/ (have: ${[...categories].join(", ")})`);
  if (d.author && !doctors.has(d.author)) err(`author "${d.author}" isn't a src/content/doctors/ id — use authorName for a plain byline`);
  for (const [i, s] of [].concat(d.sources || []).entries()) {
    if (!s || !s.text || !/^https?:\/\//.test(s.url || "")) err(`sources[${i}] needs text and an http(s) url`);
  }
  if (d.keyTakeaways && !Array.isArray(d.keyTakeaways)) err("keyTakeaways must be a list");

  if (d.titleTag && d.titleTag.length > 60) warn(`titleTag is ${d.titleTag.length} chars (keep ≤ 60)`);
  if (!d.metaDescription) warn("metaDescription is missing");
  else if (d.metaDescription.length > 160) warn(`metaDescription is ${d.metaDescription.length} chars (keep ≤ 160)`);
  if (!body) err("the post body (Markdown after the frontmatter) is empty");
  if (/^#\s/m.test(body)) err("don't use a # H1 in the body — the title comes from `name`; start sections at ##");
  if (/<script\b/i.test(body)) err("no <script> tags in post bodies");
}

for (const w of warnings) console.log(`! ${w}`);
for (const e of errors) console.log(`✖ ${e}`);
const n = files.filter((f) => /\.mdx?$/.test(f)).length;
if (errors.length) { console.log(`\n${n} post(s): ${errors.length} error(s), ${warnings.length} warning(s)`); process.exit(1); }
console.log(`✔ ${n} post(s) follow the blog post contract (${warnings.length} warning(s))`);
