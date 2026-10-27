#!/usr/bin/env node
/**
 * Pre-launch gate for a client fork: `npm run check:launch`.
 *
 * NOT part of `verify` — the template itself is all placeholders and would
 * fail by design. Run it in a client fork before sending the site for
 * approval and again before DNS moves. Each check below exists because a real
 * launch shipped (or nearly shipped) with that problem.
 *
 * Errors (✖) exit 1. Warnings (!) are listed for a human decision.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const errors = [];
const warnings = [];
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");

// Placeholder file hashes (sha256, first 16 hex; .svg normalized to LF).
// Regenerating the placeholders means updating these.
const PLACEHOLDERS = {
  "public/favicon.png": "f78ed8687b8f87d2",
  "public/favicon.ico": "a044f36f7d0cb0fe",
  "public/apple-touch-icon.png": "5efa167d2b94c8b3",
  "public/og-default.png": "62dd8714207bb21b",
  "public/logo-color.svg": "1914f5e37a9d0fdb",
  "public/logo-white.svg": "d789206c136d83b8",
};
const hash = (p) => {
  let buf = fs.readFileSync(p);
  if (p.endsWith(".svg")) buf = Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"));
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
};

// 1. site.ts — real domain and business details.
const site = read("src/data/site.ts");
const field = (name) => site.match(new RegExp(`^\\s*${name}:\\s*"([^"]*)"`, "m"))?.[1];
const url = field("url");
if (!url || /example\.com/.test(url)) errors.push(`site.ts url is "${url}" — set the confirmed production domain (apex vs www confirmed with the client).`);
for (const [name, value] of [["practiceName", field("practiceName")], ["phoneNumber", field("phoneNumber")], ["email", field("email")], ["addressLine2", field("addressLine2")]]) {
  if (value && /\[|000\) 000|example\.com/.test(value)) errors.push(`site.ts ${name} is still a placeholder ("${value}").`);
}
for (const name of ["googleReviewsLink", "facebookReviewsLink", "yelpReviewLink"]) {
  const value = field(name);
  if (value && /example/.test(value)) errors.push(`site.ts ${name} is a placeholder — set the real link or remove it.`);
}
if (!/^\s*businessSchemaType:/m.test(site)) warnings.push(`site.ts businessSchemaType is unset (defaults to VeterinaryCare) — confirm the business type.`);
if (/^\s*mobileVet:\s*true/m.test(site) && !/^\s*showStreetAddress:/m.test(site)) warnings.push(`mobileVet is true, so the street address is hidden by default — confirm with the client (showStreetAddress).`);
if (!/^\s*callTrackingNumber:/m.test(site)) warnings.push(`No callTrackingNumber in site.ts — confirm the client has no call-tracking number.`);
if (process.env.SITE_URL) warnings.push(`SITE_URL is set (${process.env.SITE_URL}) — that makes a noindexed preview build. Remove it at launch.`);

// 2. Brand assets — client files, not the generated placeholders.
for (const [file, placeholder] of Object.entries(PLACEHOLDERS)) {
  if (fs.existsSync(file) && hash(file) === placeholder) {
    const isLogo = file.includes("logo-");
    (isLogo ? warnings : errors).push(`${file} is still the template placeholder${isLogo ? " (fine if site.ts points the logos elsewhere)" : ""}.`);
  }
}
if (fs.existsSync("public/favicon.svg")) errors.push(`public/favicon.svg exists — browsers prefer it over the PNG favicon. Delete it unless it's the client's real mark (then link it in SeoHead).`);

// 3. Forms — every embedded formId has a real snippet.
const formsSrc = read("src/data/forms.ts").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const configured = new Set([...formsSrc.matchAll(/^\s*"?([\w-]+)"?\s*:\s*`/gm)].map((m) => m[1]));
const used = new Map();
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith(".astro")) {
      for (const m of read(p).matchAll(/formId="([^"]+)"/g)) used.set(m[1], p);
    }
  }
})("src");
for (const [id, file] of used) {
  if (!configured.has(id)) errors.push(`Form "${id}" (${file}) has no embed in src/data/forms.ts — it would render the placeholder.`);
}

// 4. Deploy — the Worker name must match the Cloudflare dashboard.
const wrangler = read("wrangler.jsonc");
if (!wrangler) errors.push(`wrangler.jsonc is missing — Cloudflare would deploy its "Hello World" stub.`);
else if (/"name":\s*"skeleton"/.test(wrangler)) errors.push(`wrangler.jsonc "name" is still "skeleton" — set it to the client's Worker name.`);

// 5. Content — FAQs per service, leftover placeholder copy, legal pages.
const servicesDir = "src/content/services";
if (fs.existsSync(servicesDir)) {
  for (const f of fs.readdirSync(servicesDir).filter((f) => f.endsWith(".md"))) {
    const src = read(path.join(servicesDir, f));
    const faqs = (src.match(/^\s*- question:/gm) || []).length;
    if (faqs < 5) warnings.push(`${servicesDir}/${f} has ${faqs} FAQ(s) — the standard is 5, research-based.`);
    if (!/style:\s*"?cta"?/.test(src)) warnings.push(`${servicesDir}/${f} has no closing style: "cta" block.`);
  }
}
const placeholderCopy = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(md|mdx|json)$/.test(p) && /Example|Replace per client|Lorem ipsum/i.test(read(p))) placeholderCopy.push(p);
  }
})("src/content");
if (placeholderCopy.length) errors.push(`${placeholderCopy.length} content file(s) still contain placeholder copy:\n    ${placeholderCopy.join("\n    ")}`);
if (read("src/pages/privacy-policy.astro").includes("[Month DD, YYYY]")) errors.push(`privacy-policy.astro effectiveDate is still "[Month DD, YYYY]".`);
if (/content goes here|replace with real legal copy/i.test(read("src/pages/terms-of-use.astro"))) warnings.push(`terms-of-use.astro still has placeholder text — get the client's terms.`);

// Report.
for (const w of warnings) console.log(`! ${w}`);
for (const e of errors) console.log(`✖ ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} launch blocker(s), ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(`✔ launch checks pass (${warnings.length} warning(s) to review).`);
