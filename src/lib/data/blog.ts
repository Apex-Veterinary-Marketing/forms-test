import { getCollection, getEntry, type CollectionEntry } from "astro:content";

// Scheduled publishing. A post is live once its pubDate has passed at BUILD
// time; future-dated posts are drafts, left out of every page, the sitemap,
// search and llms.txt. The site is static, so a scheduled rebuild
// (.github/workflows/scheduled-publish.yml) is what actually releases them.
//
// Preview drafts locally with:  SHOW_SCHEDULED=1 astro dev
const showScheduled = import.meta.env.SHOW_SCHEDULED === "1" || process.env.SHOW_SCHEDULED === "1";

// Public URL of the blog. Storage never moves (src/content/blog, see
// docs/BLOG-POST-CONTRACT.md); a fork that calls it "Resources" renames
// src/pages/blog/ AND changes this one constant — every link follows it.
export const BLOG_BASE = "/blog";
export const postHref = (post: { id: string }) => `${BLOG_BASE}/${post.id}`;

export function isPublished(post: CollectionEntry<"blog">, now = new Date()) {
  return !post.data.draft && post.data.pubDate.getTime() <= now.getTime();
}

export async function getAllPosts() {
  const posts = await getCollection("blog", (post) => showScheduled || isPublished(post));
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}
export async function getPostBySlug(slug: string) {
  const post = await getEntry("blog", slug);
  return post && (showScheduled || isPublished(post)) ? post : undefined;
}
export async function getPostsByCategory(categorySlug: string) {
  const all = await getAllPosts();
  return all.filter((p) => p.data.category.some((ref) => ref.id === categorySlug));
}
// Every post including drafts, oldest first — for tooling/reporting only, never for pages.
export async function getPublishingSchedule() {
  const posts = await getCollection("blog");
  return posts.sort((a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf());
}

// Links to <BLOG_BASE>/<slug> inside rich-text content (FAQ answers, service
// pages) are unwrapped to plain text while that post is still scheduled, and
// come back automatically on the first build after its pubDate — so content
// can link ahead to a scheduled post without shipping a broken link.
export async function unlinkScheduledArticles(html: string) {
  const live = new Set((await getAllPosts()).map((p) => p.id));
  const base = BLOG_BASE.replace(/[/.]/g, "\\$&");
  const link = new RegExp(`<a href="${base}/([a-z0-9-]+)/?"[^>]*>([\\s\\S]*?)</a>`, "g");
  return html.replace(link, (match, slug, text) => (live.has(slug) ? match : text));
}
