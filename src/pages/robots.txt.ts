// Dynamic endpoint, not a static public/robots.txt, so the Sitemap: line
// always points at the real domain configured in src/data/site.ts — a
// static file can't interpolate that. The build writes /sitemap.xml (see
// singleSitemap in astro.config.mjs); this just points at it.
// See Skeleton-Build-Spec.md §10.
import type { APIRoute } from "astro";
import { siteInfo } from "../data/site";

export const GET: APIRoute = ({ site }) => {
  // Preview builds (SITE_URL override ≠ production domain, see astro.config.mjs)
  // must not be crawled.
  const isPreview = !!site && !!siteInfo.url && site.origin !== new URL(siteInfo.url).origin;
  const body = isPreview
    ? `User-agent: *\nDisallow: /\n`
    : `User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap.xml", site).href}\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
