// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteInfo } from './src/data/site.ts';

// The domain lives in exactly one place: src/data/site.ts's `url` field (the
// per-client config singleton). Astro needs it statically at config time to
// build canonical URLs, OG/Twitter tags, and the sitemap (see integrations
// below) — so it's imported here rather than duplicated as a separate env
// var or hard-coded string. Update site.ts, not this file, to change domains.
//
// Pre-launch previews: an optional SITE_URL build variable overrides the
// domain (e.g. the Cloudflare workers.dev address while DNS still points at
// the old site), so share images, canonicals and the sitemap resolve on the
// host actually serving the build. Preview builds are noindexed (BaseLayout)
// and disallowed in robots.txt. Remove SITE_URL from the host's build
// settings at launch.
const siteUrl = (process.env.SITE_URL || siteInfo.url || '').replace(/\/$/, '');

// /sitemap.xml — generated on every build, so it is always current: a new page
// or a newly published blog post is in it as soon as that build deploys (every
// push to main, plus the weekly scheduled-publish rebuild). Nothing to update
// by hand. @astrojs/sitemap lists every built route in sitemap-index.xml +
// sitemap-N.xml; this step merges them into one standard /sitemap.xml and drops
// any page that is noindex or only a redirect, reading the built HTML itself.
// `npm run check:links` fails the build if the sitemap and the pages disagree.
/** @type {import('astro').AstroIntegration} */
const singleSitemap = {
  name: 'single-sitemap-xml',
  hooks: {
    'astro:build:done': ({ dir, logger }) => {
      const out = fileURLToPath(dir);
      const parts = fs.readdirSync(out).filter((f) => /^sitemap-\d+\.xml$/.test(f)).sort();
      const all = parts.flatMap((f) => fs.readFileSync(path.join(out, f), 'utf8').match(/<url>[\s\S]*?<\/url>/g) || []);
      const indexable = all.filter((entry) => {
        const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
        if (!loc) return false;
        const file = path.join(out, decodeURI(new URL(loc).pathname), 'index.html');
        if (!fs.existsSync(file)) return true;
        const html = fs.readFileSync(file, 'utf8');
        const noindex = /<meta name="robots" content="[^"]*noindex/i.test(html);
        const redirect = /http-equiv="refresh"/i.test(html) && html.length < 2000;
        return !noindex && !redirect;
      });
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...indexable,
        '</urlset>',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(out, 'sitemap.xml'), xml);
      logger.info(`sitemap.xml written (${indexable.length} URLs${all.length > indexable.length ? `, ${all.length - indexable.length} noindex/redirect page(s) left out` : ''})`);
    },
  },
};

export default defineConfig({
  site: siteUrl,
  // sitemap() lists every route; singleSitemap turns that into /sitemap.xml,
  // which robots.txt (src/pages/robots.txt.ts) points to.
  integrations: [sitemap(), singleSitemap],
});
