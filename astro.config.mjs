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

// GitHub Pages demo: the site is served from a sub-path
// (apex-veterinary-marketing.github.io/forms-test/), not a domain root, but the
// components hard-code root-relative URLs (href="/contact-us", src="/images/…",
// CSS url(/_astro/…)). When BASE_PATH is set (only deploy-pages.yml sets it,
// from actions/configure-pages), this step prefixes every root-relative URL and
// every absolute URL on the site's own origin in the built files. Local and
// Cloudflare builds leave BASE_PATH unset and are unaffected. With a custom
// domain, configure-pages reports an empty base path and nothing is rewritten.
const basePath = (process.env.BASE_PATH || '').replace(/\/$/, '');
/** @type {import('astro').AstroIntegration} */
const basePathRewrite = {
  name: 'base-path-rewrite',
  hooks: {
    'astro:build:done': ({ dir, logger }) => {
      if (!basePath) return;
      const out = fileURLToPath(dir);
      const seg = basePath.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // "/x" but not "//cdn…" and not already "/forms-test/…"
      const rel = `/(?!/)(?!${seg}(?:/|$))`;
      const origin = siteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rules = [
        [new RegExp(`(=")${rel}`, 'g'), `$1${basePath}/`], // attributes
        // srcset: the first candidate is covered above, the rest follow a comma
        [/(srcset=")([^"]*)"/g, (_, attr, list) => `${attr}${list.replace(new RegExp(`(,\\s*)${rel}`, 'g'), `$1${basePath}/`)}"`],
        [new RegExp(`(url\\(["']?)${rel}`, 'g'), `$1${basePath}/`], // CSS / inline styles
        [new RegExp(`(;\\s*url=)${rel}`, 'gi'), `$1${basePath}/`], // meta refresh redirects
        [new RegExp(`(${origin})${rel}`, 'g'), `$1${basePath}/`], // canonical, og:*, JSON-LD, sitemap
        [new RegExp(`(${origin})(?=["<\\s]|$)`, 'gm'), `$1${basePath}`], // bare origin
      ];
      let count = 0;
      const walk = (d) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const file = path.join(d, entry.name);
          if (entry.isDirectory()) walk(file);
          else if (/\.(html|css|xml|txt)$/.test(entry.name)) {
            const before = fs.readFileSync(file, 'utf8');
            const after = rules.reduce((text, [re, to]) => text.replace(re, to), before);
            if (after !== before) { fs.writeFileSync(file, after); count++; }
          }
        }
      };
      walk(out);
      logger.info(`prefixed URLs with ${basePath} in ${count} file(s)`);
    },
  },
};

export default defineConfig({
  site: siteUrl,
  // sitemap() lists every route; singleSitemap turns that into /sitemap.xml,
  // which robots.txt (src/pages/robots.txt.ts) points to. basePathRewrite runs
  // last so it sees the finished sitemap.
  integrations: [sitemap(), singleSitemap, basePathRewrite],
});
