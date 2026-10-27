// Tests for the pure functions in publish-from-issue.mjs — `npm run test:publish`
// (part of `verify`). No network, no git: fixtures in scripts/fixtures/publish/
// are sample issue bodies in the format documented in docs/BLOG-POST-CONTRACT.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  parseIssue, validatePost, cleanBody, buildFrontMatter, renderPost, postUrl,
  isAllowedPublisher, readSiteUrl, readBlogBase, trimAtWord, skipReason,
} from "./publish-from-issue.mjs";

const yaml = createRequire(import.meta.url)("js-yaml");
const fixture = (name) => fs.readFileSync(new URL(`./fixtures/publish/${name}.md`, import.meta.url), "utf8");
const OPTS = { today: "2026-10-01", imageHosts: ["images.example.com"] };
const run = (name, opts = OPTS) => {
  const parsed = parseIssue(fixture(name));
  assert.deepEqual(parsed.errors, [], `${name}: parse errors`);
  return { ...validatePost(parsed.data, parsed.markdown, opts), markdown: parsed.markdown };
};
const frontMatter = (text) => yaml.load(text.match(/^---\n([\s\S]*?)\n---\n/)[1]);

test("happy path: parses, validates and renders a valid post", () => {
  const r = run("happy");
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.post.slug, "summer-heat-safety-for-dogs");
  assert.equal(r.post.imageUrl, "https://images.example.com/blog/summer-heat.jpg");

  const text = renderPost(r.post, cleanBody(r.markdown));
  const d = frontMatter(text);
  assert.equal(d.name, "Summer Heat Safety for Dogs");
  assert.equal(d.pubDate.toISOString().slice(0, 10), "2026-09-30");
  assert.equal(d.draft, false);
  assert.equal(d.postThumbnail, "../../assets/blog/summer-heat-safety-for-dogs.jpg");
  assert.equal(d.thumbnailAlt, "Dog resting in the shade on a summer lawn");
  assert.deepEqual(d.keyTakeaways, ["Asphalt can be 50°F hotter than the air. [1]", "Walk early or late, and carry water."]);
  assert.equal(d.sources[0].url, "https://www.avma.org/resources/pet-owners/petcare/warm-weather-pet-safety");
  assert.equal(d.category, undefined);
  assert.match(text, /\n---\n\nHot days are hard on dogs/);
  assert.match(text, /### When to call us\n/);
  assert.ok(text.endsWith("call right away.\n"));
});

test("front matter keys come out in contract order", () => {
  const r = run("happy");
  const keys = [...buildFrontMatter(r.post).matchAll(/^([a-zA-Z]+):/gm)].map((m) => m[1]);
  assert.deepEqual(keys, [
    "name", "pubDate", "draft", "titleTag", "metaDescription", "postSummary", "postThumbnail",
    "thumbnailAlt", "authorName", "readTime", "keyTakeaways", "sources", "featured",
  ]);
});

test("draft: draft true is kept; draft defaults to false", () => {
  const r = run("draft");
  assert.deepEqual(r.errors, []);
  assert.equal(frontMatter(renderPost(r.post, cleanBody(r.markdown))).draft, true);

  const parsed = parseIssue(fixture("happy").replace('"draft": false,\n', ""));
  const r2 = validatePost(parsed.data, parsed.markdown, OPTS);
  assert.equal(r2.post.draft, false);
  assert.match(buildFrontMatter(r2.post), /^draft: false$/m);
});

test("missing field: name and thumbnailAlt are required", () => {
  const r = run("missing-field");
  assert.ok(r.errors.some((e) => /\bname\b/.test(e)), r.errors.join("\n"));
  assert.ok(r.errors.some((e) => /thumbnailAlt/.test(e)), r.errors.join("\n"));
});

test("missing field: slug, pubDate, image_url and an empty body fail", () => {
  const r = validatePost({ name: "x", thumbnailAlt: "y" }, "   \n", OPTS);
  for (const f of ["slug", "pubDate", "image_url", "body"]) assert.ok(r.errors.some((e) => e.includes(f)), `expected an error about ${f}: ${r.errors.join("\n")}`);
});

test("bad slug: rejected, and slugs over 80 chars too", () => {
  assert.ok(run("bad-slug").errors.some((e) => /slug/.test(e)));
  const long = "a".repeat(81);
  const parsed = parseIssue(fixture("happy").replace("summer-heat-safety-for-dogs", long));
  assert.ok(validatePost(parsed.data, parsed.markdown, OPTS).errors.some((e) => /80/.test(e)));
});

test("future date: a pubDate after today (UTC) is rejected; today is fine", () => {
  assert.ok(run("future-date").errors.some((e) => /pubDate/.test(e) && /future/.test(e)));
  assert.deepEqual(run("happy", { ...OPTS, today: "2026-09-30" }).errors, []);
  assert.ok(run("happy", { ...OPTS, today: "2026-09-29" }).errors.some((e) => /future/.test(e)));
});

test("pubDate must be a real YYYY-MM-DD date", () => {
  for (const bad of ["2026-9-30", "2026-02-30", "30/09/2026", "2026-09-30T10:00:00Z"]) {
    const parsed = parseIssue(fixture("happy").replace("2026-09-30", bad));
    assert.ok(validatePost(parsed.data, parsed.markdown, OPTS).errors.some((e) => /pubDate/.test(e)), bad);
  }
});

test("H1 in the body: leading H1 dropped, other H1s demoted to ##", () => {
  const r = run("h1-body");
  assert.deepEqual(r.errors, []);
  const body = cleanBody(r.markdown);
  assert.doesNotMatch(body, /^# /m);
  assert.doesNotMatch(body, /A Post That Repeats Its Title/);
  assert.match(body, /^## A Section Written as H1$/m);
  assert.match(body, /^## A Normal Section$/m);
  assert.ok(body.startsWith("Opening paragraph."));
});

test("<script>, style= and <iframe> in the body are rejected", () => {
  const errors = run("script-body").errors.join("\n");
  assert.match(errors, /<script/);
  assert.match(errors, /style=/);
  assert.match(errors, /<iframe/);
});

test("long titleTag / metaDescription: warned and trimmed at a word boundary, not failed", () => {
  const r = run("long-title-tag");
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 2);
  assert.ok(r.post.titleTag.length <= 60);
  assert.ok(r.post.metaDescription.length <= 160);
  assert.equal(r.post.titleTag, "How to Keep Your Senior Dog Comfortable Through a Long Cold");
  assert.ok(!r.post.metaDescription.endsWith(" "));
  assert.equal(trimAtWord("short", 60), "short");
  assert.equal(trimAtWord("x".repeat(70), 60).length, 60); // no space to break at: hard cut
});

test("unknown keys and category: ignored, with a note", () => {
  const r = run("unknown-keys");
  assert.deepEqual(r.errors, []);
  assert.equal(r.post.category, undefined);
  const notes = r.notes.join("\n");
  assert.match(notes, /category/);
  assert.match(notes, /hubspotId/);
  assert.match(notes, /seoScore/);
  assert.doesNotMatch(buildFrontMatter(r.post), /^(category|hubspotId|seoScore):/m);
});

test("image_url: https and an allowed host only; an empty host list allows nothing", () => {
  const withUrl = (url, opts = OPTS) => {
    const parsed = parseIssue(fixture("happy").replace("https://images.example.com/blog/summer-heat.jpg", url));
    return validatePost(parsed.data, parsed.markdown, opts).errors.join("\n");
  };
  assert.match(withUrl("http://images.example.com/a.jpg"), /https/);
  assert.match(withUrl("https://evil.example.net/a.jpg"), /BLOG_IMAGE_HOSTS/);
  assert.match(withUrl("https://images.example.com.evil.net/a.jpg"), /BLOG_IMAGE_HOSTS/);
  assert.match(withUrl("not a url"), /image_url/);
  assert.match(withUrl("https://images.example.com/a.jpg", { ...OPTS, imageHosts: [] }), /BLOG_IMAGE_HOSTS/);
  assert.equal(withUrl("https://IMAGES.example.com/a.jpg"), "");
});

test("sources must have text and an http(s) url", () => {
  const parsed = parseIssue(fixture("happy").replace("https://www.avma.org/resources/pet-owners/petcare/warm-weather-pet-safety", "javascript:alert(1)"));
  assert.ok(validatePost(parsed.data, parsed.markdown, OPTS).errors.some((e) => /sources\[0\]/.test(e)));
});

test("wrong types fail instead of being written", () => {
  const parsed = parseIssue(fixture("happy"));
  const bad = { ...parsed.data, draft: "no", featured: 1, keyTakeaways: "one", name: 42 };
  const errors = validatePost(bad, parsed.markdown, OPTS).errors.join("\n");
  for (const f of ["draft", "featured", "keyTakeaways", "name"]) assert.match(errors, new RegExp(f));
});

test("parseIssue: CRLF bodies, a missing JSON block, bad JSON and a missing ## Body", () => {
  const crlf = parseIssue(fixture("happy").replace(/\n/g, "\r\n"));
  assert.deepEqual(crlf.errors, []);
  assert.equal(crlf.data.slug, "summer-heat-safety-for-dogs");
  assert.doesNotMatch(crlf.markdown, /\r/);

  assert.match(parseIssue("## Body\n\nText").errors.join(), /```json/);
  assert.match(parseIssue('```json\n{ "slug": \n```\n\n## Body\n\nText').errors.join(), /JSON/);
  assert.match(parseIssue('```json\n["a"]\n```\n\n## Body\n\nText').errors.join(), /object/);
  assert.match(parseIssue('```json\n{ "slug": "a" }\n```\n\nText with no heading').errors.join(), /## Body/);
});

test("YAML strings survive quotes, colons, #, leading dashes, yes/no, backslashes and line separators", () => {
  const tricky = `She said "sit": #1 rule \\ - yes${String.fromCharCode(0x2028)}next`;
  const parsed = parseIssue(fixture("happy"));
  const data = { ...parsed.data, name: tricky, postSummary: "yes", thumbnailAlt: "- dash", keyTakeaways: ["null", "a: b"] };
  const r = validatePost(data, parsed.markdown, OPTS);
  assert.deepEqual(r.errors, []);
  const d = frontMatter(renderPost(r.post, "Body."));
  assert.equal(d.name, tricky);
  assert.equal(d.postSummary, "yes");
  assert.equal(d.thumbnailAlt, "- dash");
  assert.deepEqual(d.keyTakeaways, ["null", "a: b"]);
});

test("postUrl joins siteInfo.url, BLOG_BASE and the slug, with the canonical trailing slash", () => {
  assert.equal(postUrl("https://example.com", "/blog", "a-post"), "https://example.com/blog/a-post/");
  assert.equal(postUrl("https://example.com/", "/resources/", "a-post"), "https://example.com/resources/a-post/");
});

test("readSiteUrl / readBlogBase read the site's own config files", () => {
  const site = 'export interface SiteInfo {\n  url?: string; // origin\n}\nexport const siteInfo = {\n  url: "https://farrwestanimalhospital.com", // apex\n};';
  assert.equal(readSiteUrl(site), "https://farrwestanimalhospital.com");
  assert.equal(readBlogBase('export const BLOG_BASE = "/resources";'), "/resources");
  assert.equal(readBlogBase("nothing here"), "/blog");
  assert.equal(readSiteUrl(fs.readFileSync(new URL("../src/data/site.ts", import.meta.url), "utf8")).startsWith("https://"), true);
});

test("isAllowedPublisher: exact, case-insensitive, comma-separated; empty list allows nobody", () => {
  assert.equal(isAllowedPublisher("mark-apex", "alice, Mark-Apex ,bob"), true);
  assert.equal(isAllowedPublisher("mark", "mark-apex,bob"), false);
  assert.equal(isAllowedPublisher("mark", ""), false);
  assert.equal(isAllowedPublisher("", "mark"), false);
});

test("skipReason: a closed or already-published issue is skipped; an open or failed one goes ahead", () => {
  assert.equal(skipReason({ state: "open", labels: [] }), "");
  assert.equal(skipReason({ state: "open", labels: [{ name: "publish-failed" }, { name: "blog-post" }] }), "");
  assert.equal(skipReason(null), "");
  assert.match(skipReason({ state: "closed", labels: [] }), /closed/);
  assert.match(skipReason({ state: "open", labels: [{ name: "published" }] }), /published/);
  assert.match(skipReason({ state: "open", labels: ["publish-duplicate"] }), /publish-duplicate/);
});
