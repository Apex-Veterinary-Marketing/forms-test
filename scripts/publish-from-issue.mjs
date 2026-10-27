#!/usr/bin/env node
/**
 * Publish a blog post from a GitHub issue — run by
 * .github/workflows/publish-from-issue.yml (docs/BLOG-POST-CONTRACT.md → Publishing flow).
 *
 * SHARED FILE: byte-identical in every Skeleton site. Change it in the template
 * (skeleton-master-astro) and copy it; never edit it in a site repo.
 *
 * The issue body is a ```json block of post fields, then a "## Body" heading and
 * the post in Markdown. Steps, stopping at the first failure (main is only
 * touched by the final commit):
 *   1. parse the issue          2. validate the fields     3. refuse a duplicate slug
 *   4. clean the body           5. download + resize the image to src/assets/blog/<slug>.jpg
 *   6. write src/content/blog/<slug>.md
 *   7. npm run check:posts + npm run build
 *   8. commit both files to main and push (rebase + retry if main moved)
 *   9. comment the live URL, label `published`, close   /   10. on failure: comment, `publish-failed`
 *
 *   node scripts/publish-from-issue.mjs              # in the Action, configured by env:
 *     GITHUB_TOKEN GITHUB_REPOSITORY ISSUE_NUMBER ISSUE_AUTHOR ISSUE_BODY
 *     BLOG_PUBLISHERS BLOG_IMAGE_HOSTS (org variables, comma-separated)
 *   node scripts/publish-from-issue.mjs --dry-run --body-file <issue.md> [--image-file <image>]
 *     steps 1–6 into a temp directory, printed; no network, no git, no build.
 *
 * The pure functions are exported for scripts/publish-from-issue.test.mjs.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BLOG_DIR = "src/content/blog";
const IMAGE_DIR = "src/assets/blog";
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SLUG = 80;
const MAX_TITLE_TAG = 60;
const MAX_META_DESCRIPTION = 160;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const IMAGE_WIDTH = 2000;
const JPEG_QUALITY = 82;
const LOG_LINES = 40;
const PUSH_RETRIES = 3;
const LABELS = {
  published: { color: "0e8a16", description: "Blog post published by publish-from-issue" },
  "publish-failed": { color: "d93f0b", description: "Blog post failed to publish; edit the issue to retry" },
  "publish-duplicate": { color: "cfd3d7", description: "A post with this slug is already published" },
};
// Issue JSON keys the Action understands (docs/BLOG-POST-CONTRACT.md → Fields, plus image_url).
const KNOWN_KEYS = new Set([
  "slug", "name", "pubDate", "draft", "titleTag", "metaDescription", "postSummary", "image_url",
  "thumbnailAlt", "author", "authorName", "readTime", "keyTakeaways", "sources", "featured",
]);
const UNSAFE_BODY = [
  [/<script/i, "the body contains <script — scripts aren't allowed in posts"],
  [/\bstyle\s*=/i, "the body contains style= — inline styles aren't allowed; the site's design styles the post"],
  [/<iframe/i, "the body contains <iframe — embeds aren't allowed in posts"],
  [/<[^>]*\son[a-z]+\s*=/i, "the body contains an HTML event handler (onclick=, onerror=, …) — not allowed"],
  [/(?:\]\(|(?:href|src)\s*=\s*["']?)\s*javascript:/i, "the body contains a javascript: link — not allowed"],
];

// ---------------------------------------------------------------------------
// Pure functions (tested)
// ---------------------------------------------------------------------------

/** Issue body → { data, markdown, errors }. */
export function parseIssue(text) {
  const src = String(text ?? "").replace(/\r\n?/g, "\n");
  const fence = src.match(/^```json[^\S\n]*\n([\s\S]*?)\n```[^\S\n]*$/im);
  if (!fence) return { errors: ["The issue body has no ```json block with the post fields."] };
  let data;
  try {
    data = JSON.parse(fence[1]);
  } catch (e) {
    return { errors: [`The \`\`\`json block isn't valid JSON: ${e.message}`] };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { errors: ["The ```json block must be one object ({ … }) of post fields."] };
  const rest = src.slice(fence.index + fence[0].length);
  const heading = rest.match(/^##[^\S\n]+Body[^\S\n]*$/im);
  if (!heading) return { data, errors: ['Add a "## Body" heading after the ```json block, then the post in Markdown.'] };
  return { data, markdown: rest.slice(heading.index + heading[0].length).replace(/^\n+/, ""), errors: [] };
}

/** Validates the issue's fields → { post, errors, warnings, notes }. `today` is YYYY-MM-DD (UTC). */
export function validatePost(data, markdown, { today, imageHosts = [] } = {}) {
  const d = data && typeof data === "object" ? data : {};
  const post = {}, errors = [], warnings = [], notes = [];
  const missing = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim());
  const text = (key, required, hint) => {
    const v = d[key];
    if (missing(v)) { if (required) errors.push(`${key} is required${hint ? ` (${hint})` : ""}.`); return; }
    if (typeof v !== "string") { errors.push(`${key} must be text (got ${JSON.stringify(v)}).`); return; }
    post[key] = v.trim();
  };

  text("slug", true, "lowercase letters, digits and single hyphens, e.g. summer-heat-safety-for-dogs");
  if (post.slug !== undefined) {
    if (!SLUG.test(post.slug)) errors.push(`slug must be lowercase letters, digits and single hyphens (got ${JSON.stringify(post.slug)}).`);
    else if (post.slug.length > MAX_SLUG) errors.push(`slug must be ${MAX_SLUG} characters or fewer (got ${post.slug.length}).`);
  }

  text("pubDate", true, "YYYY-MM-DD, the day the issue is opened");
  if (post.pubDate !== undefined) {
    if (!isRealDate(post.pubDate)) errors.push(`pubDate must be a real date written YYYY-MM-DD (got ${JSON.stringify(post.pubDate)}).`);
    else if (today && post.pubDate > today) errors.push(`pubDate ${post.pubDate} is in the future (today is ${today} UTC). Automated posts publish on the day the issue is opened: use today's date.`);
  }

  text("name", true, "the post title");
  text("thumbnailAlt", true, "describe the image");
  for (const key of ["titleTag", "metaDescription", "postSummary", "author", "authorName", "readTime"]) text(key, false);
  for (const [key, max] of [["titleTag", MAX_TITLE_TAG], ["metaDescription", MAX_META_DESCRIPTION]]) {
    if (post[key] && post[key].length > max) {
      const trimmed = trimAtWord(post[key], max);
      warnings.push(`${key} was ${post[key].length} characters (keep it ≤ ${max}); trimmed to "${trimmed}".`);
      post[key] = trimmed;
    }
  }

  for (const key of ["draft", "featured"]) {
    if (missing(d[key])) continue;
    if (typeof d[key] !== "boolean") errors.push(`${key} must be true or false (got ${JSON.stringify(d[key])}).`);
    else post[key] = d[key];
  }
  if (post.draft === undefined) post.draft = false;

  if (!missing(d.keyTakeaways)) {
    if (!Array.isArray(d.keyTakeaways) || d.keyTakeaways.some((t) => typeof t !== "string")) errors.push("keyTakeaways must be a list of text.");
    else post.keyTakeaways = d.keyTakeaways.map((t) => t.trim()).filter(Boolean);
  }
  if (!missing(d.sources)) {
    if (!Array.isArray(d.sources)) errors.push("sources must be a list of { text, url }.");
    else {
      post.sources = [];
      d.sources.forEach((s, i) => {
        const ok = s && typeof s === "object" && typeof s.text === "string" && s.text.trim() && typeof s.url === "string" && isHttpUrl(s.url.trim());
        if (!ok) errors.push(`sources[${i}] needs text and an http(s) url.`);
        else post.sources.push({ text: s.text.trim(), url: s.url.trim() });
      });
    }
  }

  const imageUrl = d.image_url;
  if (missing(imageUrl)) errors.push("image_url is required (an https link to the post image).");
  else if (typeof imageUrl !== "string" || !URL.canParse(imageUrl.trim())) errors.push(`image_url isn't a valid URL (got ${JSON.stringify(imageUrl)}).`);
  else {
    const url = new URL(imageUrl.trim());
    const hosts = imageHosts.map((h) => h.trim().toLowerCase()).filter(Boolean);
    if (url.protocol !== "https:") errors.push("image_url must start with https://.");
    else if (!hosts.length) errors.push("BLOG_IMAGE_HOSTS is empty, so no image host is allowed yet. Ask the agency to set the org variable.");
    else if (!hosts.includes(url.hostname)) errors.push(`image_url host "${url.hostname}" isn't allowed. Allowed hosts (BLOG_IMAGE_HOSTS): ${hosts.join(", ")}.`);
    else post.imageUrl = imageUrl.trim();
  }

  const body = String(markdown ?? "");
  if (!cleanBody(body).trim()) errors.push("The body (the Markdown after ## Body) is empty.");
  for (const [re, message] of UNSAFE_BODY) if (re.test(body)) errors.push(`${message[0].toUpperCase()}${message.slice(1)}.`);

  if ("category" in d) notes.push("category was ignored: vet sites don't use blog categories.");
  if ("postThumbnail" in d) notes.push("postThumbnail was ignored: it's set from image_url.");
  const unknown = Object.keys(d).filter((k) => !KNOWN_KEYS.has(k) && k !== "category" && k !== "postThumbnail");
  if (unknown.length) notes.push(`Ignored unknown field(s): ${unknown.join(", ")}.`);

  return { post, errors, warnings, notes };
}

/** Drops a leading "# Title" line and demotes any other "# " heading to "## ". */
export function cleanBody(markdown) {
  const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
  const first = lines.findIndex((l) => l.trim() !== "");
  if (first >= 0 && /^#[ \t]/.test(lines[first])) lines.splice(first, 1);
  const body = lines.map((l) => l.replace(/^#([ \t])/, "##$1")).join("\n");
  return body.replace(/^(?:[ \t]*\n)+/, "").trimEnd() + "\n";
}

/** Front matter in contract order (docs/BLOG-POST-CONTRACT.md → Fields); every string via JSON.stringify. */
export function buildFrontMatter(post) {
  const out = ["---"];
  const line = (key, value) => out.push(`${key}: ${value}`);
  line("name", q(post.name));
  line("pubDate", post.pubDate);
  line("draft", String(post.draft === true));
  for (const key of ["titleTag", "metaDescription", "postSummary"]) if (post[key]) line(key, q(post[key]));
  line("postThumbnail", q(`../../assets/blog/${post.slug}.jpg`));
  line("thumbnailAlt", q(post.thumbnailAlt));
  for (const key of ["author", "authorName", "readTime"]) if (post[key]) line(key, q(post[key]));
  if (post.keyTakeaways?.length) out.push("keyTakeaways:", ...post.keyTakeaways.map((t) => `  - ${q(t)}`));
  if (post.sources?.length) out.push("sources:", ...post.sources.flatMap((s) => [`  - text: ${q(s.text)}`, `    url: ${q(s.url)}`]));
  if (typeof post.featured === "boolean") line("featured", String(post.featured));
  out.push("---");
  return out.join("\n") + "\n";
}

/** The complete src/content/blog/<slug>.md file. */
export function renderPost(post, body) {
  return `${buildFrontMatter(post)}\n${body}`;
}

/** siteInfo.url + BLOG_BASE + /<slug>/ — with the trailing slash, the canonical form (the
 *  sitemap and <link rel="canonical"> use it; Cloudflare redirects the bare form to it). */
export function postUrl(siteUrl, blogBase, slug) {
  return [String(siteUrl).replace(/\/+$/, ""), String(blogBase).replace(/^\/+|\/+$/g, ""), slug].filter(Boolean).join("/") + "/";
}

/** Exact, case-insensitive match against a comma-separated list (BLOG_PUBLISHERS). */
export function isAllowedPublisher(login, list) {
  return Boolean(login) && parseList(list).includes(String(login).toLowerCase());
}

/** Why the issue, as it is now, shouldn't be processed ("" = go ahead). A run can start after
 *  an earlier run for the same issue already published it (an edit queued behind it). */
export function skipReason(issue) {
  if (!issue) return "";
  if (issue.state && issue.state !== "open") return `the issue is ${issue.state}`;
  const labels = (issue.labels ?? []).map((l) => (typeof l === "string" ? l : l?.name));
  const done = ["published", "publish-duplicate"].find((name) => labels.includes(name));
  return done ? `the issue is already labelled ${done}` : "";
}

/** siteInfo.url from src/data/site.ts. */
export function readSiteUrl(siteTs) {
  return String(siteTs).match(/^\s*url:\s*["'`]([^"'`]+)["'`]/m)?.[1] ?? "";
}

/** BLOG_BASE from src/lib/data/blog.ts ("/blog" if it isn't found). */
export function readBlogBase(blogTs) {
  return String(blogTs).match(/BLOG_BASE\s*=\s*["'`]([^"'`]*)["'`]/)?.[1] ?? "/blog";
}

/** Shortens text to ≤ max characters at a word boundary. */
export function trimAtWord(text, max) {
  if (text.length <= max) return text;
  const space = text.slice(0, max + 1).lastIndexOf(" ");
  return (space > 0 ? text.slice(0, space) : text.slice(0, max)).replace(/[\s|,;:–—-]+$/, "");
}

// U+2028/U+2029, built from char codes so no raw separator sits in this file.
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, "g");
function q(value) {
  // JSON strings are valid YAML double-quoted strings; JSON leaves U+2028/9 raw, YAML may not.
  return JSON.stringify(String(value)).replace(LINE_SEPARATORS, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
}
function isRealDate(s) {
  return DATE.test(s) && !Number.isNaN(Date.parse(s)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
}
function isHttpUrl(s) {
  return URL.canParse(s) && /^https?:$/.test(new URL(s).protocol);
}
function parseList(list) {
  return String(list ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Steps 1–6: parse, validate, duplicate check, clean, image, write
// ---------------------------------------------------------------------------

/** Writes the post and its image under outDir. Returns { errors } | { duplicate } | { post, files, ... }. */
async function stagePost({ text, today, imageHosts, repoDir, outDir, getImage }) {
  const parsed = parseIssue(text);
  if (parsed.errors.length) return { errors: parsed.errors, warnings: [], notes: [] };
  const { post, errors, warnings, notes } = validatePost(parsed.data, parsed.markdown, { today, imageHosts });
  if (errors.length) return { errors, warnings, notes };

  const existing = ["md", "mdx"].map((ext) => `${BLOG_DIR}/${post.slug}.${ext}`).find((p) => fs.existsSync(path.join(repoDir, p)));
  if (existing) return { duplicate: existing, post, warnings, notes };

  const body = cleanBody(parsed.markdown);
  const postPath = `${BLOG_DIR}/${post.slug}.md`;
  const imagePath = `${IMAGE_DIR}/${post.slug}.jpg`;
  let image = null;
  if (getImage) {
    try {
      image = await toJpeg(await getImage(post.imageUrl));
    } catch (e) {
      return { errors: [e.message], warnings, notes };
    }
  }

  fs.mkdirSync(path.join(outDir, BLOG_DIR), { recursive: true });
  fs.mkdirSync(path.join(outDir, IMAGE_DIR), { recursive: true });
  if (image) fs.writeFileSync(path.join(outDir, imagePath), image.data);
  fs.writeFileSync(path.join(outDir, postPath), renderPost(post, body));
  return { post, warnings, notes, image, files: image ? [postPath, imagePath] : [postPath] };
}

async function fetchImage(url, imageHosts) {
  const hosts = imageHosts.map((h) => h.trim().toLowerCase());
  let res;
  try {
    res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60_000), headers: { "user-agent": "publish-from-issue (GitHub Action)" } });
  } catch (e) {
    throw new Error(`Couldn't download image_url (${e.cause?.message || e.message}).`);
  }
  const final = new URL(res.url || url);
  if (final.protocol !== "https:" || !hosts.includes(final.hostname)) throw new Error(`image_url redirected to ${final.origin}, which isn't an allowed host (BLOG_IMAGE_HOSTS).`);
  if (!res.ok) throw new Error(`Downloading image_url failed: HTTP ${res.status}.`);
  const type = res.headers.get("content-type") || "";
  if (!/^image\//i.test(type)) throw new Error(`image_url isn't an image (content-type "${type || "none"}").`);
  const tooBig = () => new Error(`The image is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB. Use a smaller file.`);
  if (Number(res.headers.get("content-length")) > MAX_IMAGE_BYTES) throw tooBig();
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > MAX_IMAGE_BYTES) throw tooBig();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function readImageFile(file) {
  if (fs.statSync(file).size > MAX_IMAGE_BYTES) throw new Error(`The image is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
  return fs.readFileSync(file);
}

async function toJpeg(input) {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    throw new Error("sharp isn't installed (Astro installs it): run npm ci.");
  }
  try {
    const { data, info } = await sharp(input)
      .rotate()
      .resize({ width: IMAGE_WIDTH, withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch (e) {
    throw new Error(`The image couldn't be read (${e.message}). Use a JPG, PNG or WebP.`);
  }
}

// ---------------------------------------------------------------------------
// Steps 7–10 (the Action only): build, commit, push, report
// ---------------------------------------------------------------------------

function run(cmd, args) {
  // npm/npx are .cmd shims on Windows (local runs); git must not go through a shell (quoting).
  const shell = process.platform === "win32" && cmd !== "git";
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? r.error.message : ""}`;
  process.stdout.write(`$ ${cmd} ${args.join(" ")}\n${output}`);
  return { ok: r.status === 0, output };
}
const tail = (output) => output.trimEnd().split("\n").slice(-LOG_LINES).join("\n");

function buildSite() {
  // The site's own build script (what Cloudflare runs), not a bare `astro build`.
  for (const [cmd, args, what] of [["npm", ["run", "check:posts"], "npm run check:posts"], ["npm", ["run", "build"], "npm run build"]]) {
    const r = run(cmd, args);
    if (!r.ok) return { error: `${what} failed (see the output below).`, log: tail(r.output) };
  }
  return {};
}

function commitAndPush(files, message) {
  const steps = [
    ["config", "user.name", "github-actions[bot]"],
    ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"],
    ["add", "--", ...files],
    ["commit", "-m", message],
  ];
  for (const args of steps) {
    const r = run("git", args);
    if (!r.ok) return { error: `git ${args[0]} failed.`, log: tail(r.output) };
  }
  for (let attempt = 0; ; attempt++) {
    const push = run("git", ["push", "origin", "HEAD:main"]);
    if (push.ok) return { sha: run("git", ["rev-parse", "HEAD"]).output.trim().split("\n").pop() };
    if (attempt >= PUSH_RETRIES) return { error: `git push was rejected ${attempt + 1} times.`, log: tail(push.output) };
    const pull = run("git", ["pull", "--rebase", "--autostash", "origin", "main"]);
    if (!pull.ok) {
      run("git", ["rebase", "--abort"]);
      return { error: "main changed while publishing and the post couldn't be rebased onto it.", log: tail(pull.output) };
    }
  }
}

function github(token, repo) {
  const api = process.env.GITHUB_API_URL || "https://api.github.com";
  return async (method, route, body, ignore = []) => {
    const res = await fetch(`${api}/repos/${repo}${route}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok && !ignore.includes(res.status)) throw new Error(`GitHub API ${method} ${route}: HTTP ${res.status} ${await res.text()}`);
    return res.ok ? res.json().catch(() => null) : null;
  };
}

async function report(gh, issue, { comment, add, remove = [], close }) {
  for (const [name, label] of Object.entries(LABELS)) await gh("POST", "/labels", { name, ...label }, [422]);
  await gh("POST", `/issues/${issue}/comments`, { body: comment });
  await gh("POST", `/issues/${issue}/labels`, { labels: [add] });
  for (const name of remove) await gh("DELETE", `/issues/${issue}/labels/${encodeURIComponent(name)}`, null, [404]);
  if (close) await gh("PATCH", `/issues/${issue}`, { state: "closed", state_reason: close });
}

const bullets = (items) => items.map((i) => `- ${i}`).join("\n");

function failureComment(errors, log) {
  const parts = ["**Couldn't publish this post.** `main` hasn't changed.", "", bullets(errors)];
  if (log) parts.push("", `<details><summary>Last ${LOG_LINES} lines of output</summary>`, "", "```text", log.replaceAll("```", "'''"), "```", "", "</details>");
  parts.push("", "Fix the issue body, then **edit this issue to retry**. Field rules: `docs/BLOG-POST-CONTRACT.md`.");
  return parts.join("\n");
}

async function publish() {
  const env = process.env;
  if (!isAllowedPublisher(env.ISSUE_AUTHOR, env.BLOG_PUBLISHERS)) return console.log(`Skipped: ${env.ISSUE_AUTHOR || "(unknown)"} isn't in BLOG_PUBLISHERS.`);
  const text = env.ISSUE_BODY ?? "";
  if (!/```json/i.test(text)) return console.log("Skipped: the issue has no ```json block.");
  for (const key of ["GITHUB_TOKEN", "GITHUB_REPOSITORY", "ISSUE_NUMBER"]) if (!env[key]) throw new Error(`${key} isn't set.`);

  const issue = env.ISSUE_NUMBER;
  const gh = github(env.GITHUB_TOKEN, env.GITHUB_REPOSITORY);
  const imageHosts = parseList(env.BLOG_IMAGE_HOSTS);
  const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
  const urlFor = (slug) => postUrl(readSiteUrl(read("src/data/site.ts")), readBlogBase(read("src/lib/data/blog.ts")), slug);
  const fail = async (errors, log) => {
    console.log(`✖ ${errors.join("\n✖ ")}`);
    await report(gh, issue, { comment: failureComment(errors, log), add: "publish-failed" });
    process.exitCode = 1;
  };

  let pushed = null;
  try {
    // The event payload is a snapshot; re-read the issue so a queued edit doesn't re-publish.
    const why = skipReason(await gh("GET", `/issues/${issue}`));
    if (why) return console.log(`Skipped: ${why}.`);

    const staged = await stagePost({
      text, today: todayUtc(), imageHosts, repoDir: ".", outDir: ".",
      getImage: (url) => fetchImage(url, imageHosts),
    });
    if (staged.errors) return await fail(staged.errors);
    const { post } = staged;
    if (staged.duplicate) {
      console.log(`Duplicate: ${staged.duplicate} already exists.`);
      return await report(gh, issue, {
        comment: `**Already published** at ${urlFor(post.slug)} (\`${staged.duplicate}\`), so nothing was changed.\n\nUpdating an existing post isn't supported yet. For a new post, open a new issue with a new \`slug\`.`,
        add: "publish-duplicate",
        close: "not_planned",
      });
    }

    const build = buildSite();
    if (build.error) return await fail([build.error], build.log);
    const push = commitAndPush(staged.files, `Blog: publish ${post.slug} (#${issue})`);
    if (push.error) return await fail([push.error], push.log);
    pushed = push;

    const url = urlFor(post.slug);
    const notes = [...staged.warnings, ...staged.notes];
    const comment = [
      `**Published:** ${url}`,
      "",
      "Live after Cloudflare deploys, usually a few minutes; draft posts never show.",
      ...(post.draft ? ["", "This post is a **draft** (`draft: true`), so it won't appear on the site."] : []),
      "",
      `Commit ${pushed.sha}: \`${staged.files.join("`, `")}\``,
      ...(notes.length ? ["", "**Notes**", bullets(notes)] : []),
    ].join("\n");
    await report(gh, issue, { comment, add: "published", remove: ["publish-failed"], close: "completed" });
    console.log(`✔ Published ${url}`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
    // Once pushed, the post is live: don't label it failed, just leave the run red.
    if (pushed) return console.error(`The post was pushed (${pushed.sha}) but reporting on the issue failed.`);
    await fail([`Unexpected error: ${e.message}`]).catch((e2) => console.error(e2));
  }
}

async function dryRun(args) {
  if (!args.bodyFile) throw new Error("--dry-run needs --body-file <issue body .md>");
  const text = fs.readFileSync(args.bodyFile, "utf8");
  let imageHosts = parseList(process.env.BLOG_IMAGE_HOSTS);
  if (!imageHosts.length) {
    const imageUrl = parseIssue(text).data?.image_url;
    const host = URL.canParse(imageUrl) ? new URL(imageUrl).hostname : "";
    imageHosts = host ? [host] : [];
    console.log(`! BLOG_IMAGE_HOSTS isn't set: allowing image_url's own host (${host || "none"}) for this dry run.`);
  }
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "publish-from-issue-"));
  const staged = await stagePost({
    text, today: todayUtc(), imageHosts, repoDir: ".", outDir,
    getImage: args.imageFile ? () => readImageFile(args.imageFile) : null,
  });
  for (const w of staged.warnings ?? []) console.log(`! ${w}`);
  for (const n of staged.notes ?? []) console.log(`· ${n}`);
  if (staged.errors) {
    for (const e of staged.errors) console.log(`✖ ${e}`);
    process.exitCode = 1;
    return;
  }
  if (staged.duplicate) return console.log(`= Duplicate: ${staged.duplicate} already exists; the Action would comment, label publish-duplicate and close.`);
  if (!args.imageFile) console.log(`! No --image-file: image step skipped (${IMAGE_DIR}/${staged.post.slug}.jpg not written).`);
  const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
  console.log(`\nWrote into ${outDir}:`);
  for (const file of staged.files) console.log(`  ${file}`);
  if (staged.image) console.log(`  image: ${staged.image.width}×${staged.image.height} JPEG, ${(staged.image.data.length / 1024).toFixed(0)} KB`);
  console.log(`Live URL would be: ${postUrl(readSiteUrl(read("src/data/site.ts")), readBlogBase(read("src/lib/data/blog.ts")), staged.post.slug)}\n`);
  console.log(fs.readFileSync(path.join(outDir, staged.files[0]), "utf8"));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--body-file") args.bodyFile = argv[++i];
    else if (argv[i] === "--image-file") args.imageFile = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  (args.dryRun ? dryRun(args) : publish()).catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
