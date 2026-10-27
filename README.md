# Skeleton

An Astro boilerplate for veterinary clinic websites: every functional/UX widget, page route, and CMS binding a client site needs is already built — structure only, **no fixed visual design**. The intended workflow is fork this repo per client (GitHub "Use this template"), then design and style on top of it — see `src/styles/tokens.css` and the theming section below.

Full build rationale, decisions, and open questions live in the agency's `Skeleton-Build-Spec.md` (companion doc, not shipped in this repo — see your team's planning docs).

## Quickstart

```sh
npm install
npm run dev      # localhost:4321
npm run build    # -> ./dist/
npm run astro check
npm run verify   # astro check + token contract + palette-generator test + build + link check — the definition of done
npm run check:launch   # in a client fork, before review/launch: fails on leftover placeholders (domain, favicon, forms, Worker name…)
```

## Structure

```
src/
  content.config.ts      Zod schemas for all 8 content collections
  content/                doctors/, staff/, services/, service-categories/,
                          blog/, blog-categories/, testimonials/,
                          social-links/ — example entries in each
  data/site.ts            Per-client site config (practice name, phone, hours,
                          review-platform links, footer blurb, logos, and
                          `url` — the real domain, read by astro.config.mjs)
                          — NOT a content collection, a singleton. Fill this
                          in per client. (Social-profile links are the
                          `socialLinks` collection, not here.)
  lib/
    data/                 Accessor layer — pages/components import from here,
                          never from astro:content directly. Keeps a future
                          swap to an external CMS/DB cheap (see build spec §3).
    schema/organization.ts  Builds the site-wide JSON-LD Business node,
                          rendered once in BaseLayout so every page can
                          reference it by {"@id": "#business"}.
    utils/stripHtml.ts    Strips HTML from rich-text fields before they feed
                          a plain-text context (meta description, JSON-LD).
  components/             The component library — BEM-named default scaffold,
                          not a hard rule. CMS-powered ones (ServiceGrid,
                          DoctorCard, BlogGrid, etc.) take collection entries
                          as props.
  layouts/BaseLayout.astro  Every page's chrome: SEO head, schema graph,
                          header/footer/callbar, the two global modals.
  pages/                  Static pages + dynamic [slug] routes per collection.
  styles/tokens.css       Design tokens — THE file to edit per client design
                          (Tier 1 = Webflow "Base" variable collection).
                          Component markup/class names stay untouched
                          regardless of what a client's design looks like.
  styles/motion.css       Opt-in motion primitives (data-reveal / data-hover /
                          data-animate); booted by components/MotionLayer.astro
  pages/robots.txt.ts     Dynamic endpoints (not static public/ files) so they
  pages/llms.txt.ts       always reflect the real domain from site.ts's `url`
public/og-default.png    Placeholder OG/Twitter image — replace by swapping
                          this file, not by touching any code
public/favicon.*         Placeholder favicon set (PNG + ICO, no SVG) — same swap-in-place model
scripts/
  generate-palette.mjs    `npm run palette` — contrast-safe Tier 1 palette from 2 colors
  check-tokens.mjs        Token contract + palette contrast checker
  test-palette.mjs        Proves the generator passes every contrast rule (~3,000 random palettes)
  check-links.mjs         Post-build internal link/asset checker
  lib/palette.mjs         Shared color math + the contrast rules (checker AND generator)
  lib/generate.mjs        The generator's rules (skill rules + the new colors + contrast)
  generate-placeholder-assets.mjs  Regenerates the placeholder favicon + OG image (needs --force; never in a client fork)
  check-launch.mjs                 Pre-launch gate for client forks (npm run check:launch)
  publish-from-issue.mjs           Blog post from a GitHub issue (run by the publish-from-issue Action; shared, see Blog publishing)
AGENTS.md                 Rules for designer agents (read first)
```

## Content

Eight Astro Content Collections (`content.config.ts`): `doctors`, `staff`, `services`, `serviceCategories`, `blog`, `blogCategories`, `testimonials`, `socialLinks`. Add real client content as Markdown/JSON files under `src/content/<collection>/`. Field-level schemas are verified against the agency's real Webflow CMS structure — see each collection's comments in `content.config.ts` for what's required vs. optional and any Webflow→Astro shape changes (e.g. `services.contentBlocks`/`faqs` are real arrays, not Webflow's flat numbered fields).

`src/data/site.ts` holds the practice's own info (name, phone, address, hours, review-platform links, footer blurb, logos) — fill in during client intake.

## Blog publishing

The content automation publishes one post per client a week by **opening a GitHub issue** in the client's repo: a ```` ```json ```` block of post fields, then `## Body` and the Markdown. The `publish-from-issue` Action (`.github/workflows/publish-from-issue.yml` → `scripts/publish-from-issue.mjs`) validates it, downloads and resizes the image, writes `src/content/blog/<slug>.md` + `src/assets/blog/<slug>.jpg`, runs `check:posts` and the build, commits both files to `main` and comments the live URL on the issue (or what to fix, with the `publish-failed` label; editing the issue retries). Cloudflare deploys the push. Format, rules and outcomes: [`docs/BLOG-POST-CONTRACT.md`](docs/BLOG-POST-CONTRACT.md) → Publishing flow.

The workflow, the script, its tests (`npm run test:publish`) and `.gitattributes` are identical in every site: change them here and copy them to the forks, never edit them in a fork.

**Turning it on for a site** (once the org-level setup exists: the `BLOG_PUBLISHERS` and `BLOG_IMAGE_HOSTS` org variables, the `blog-publishers` team and the publisher's token):

1. Add the site's repo to the `blog-publishers` team (Read).
2. In HubSpot, set the company's `website_platform`, `github_repo` (the repo name) and `blog_autopublish_enabled`.
3. Make sure Actions are enabled for the repo and nothing (branch protection or a ruleset) blocks `github-actions[bot]` from pushing to `main`.

`.github/workflows/scheduled-publish.yml` is optional: it only rebuilds hand-scheduled (future-dated) posts and skips harmlessly without a `DEPLOY_HOOK_URL` secret. Automated posts don't need it, because their commit is the release.

## Theming

`src/styles/tokens.css` is the single source of truth for every visual value. Tier 1 mirrors the agency's Webflow "Base" variable collection (18 variables, same names in kebab-case) and ships with a reference navy + teal palette — **replace it per client by generating one**: `npm run palette -- --main "#…" --cta "#…" --write` builds every Tier 1 value from the logo's two colors and adjusts lightness where needed so all text/background pairings pass WCAG AA; component markup and BEM class names never change to reskin a site. Components never contain literal colors or `var(--x, fallback)`; `npm run check:tokens` enforces that and verifies the palette's contrast (text, muted text, headings, buttons, footer, focus ring). See `AGENTS.md` for the full contract, the motion layer (`data-reveal` / `data-hover` / `data-animate`), and the rules for design agents.

**Typeface:** `src/styles/fonts.css` loads the real font (reference: Inter, self-hosted via `@fontsource`, no external request at runtime) at exactly the weights components use. Swap it per client by installing a different `@fontsource/<family>` package and updating the two `--font-*` tokens — see that file's own header comment for the exact steps.

## Forms

`GravityFormEmbed` component wraps the agency's standard Gravity Forms embed snippet — point `data-gravity-form-id` at each client's own WordPress+GF install. See the component's own comments for context modifiers (contact/appointment/general-info/modal).

**Wiring in the real form:** add each `formId → iframe snippet` pair to `src/data/forms.ts` (an iframe pointing at a WP page hosting the client's real GF form — stage 1; a native Astro form UI on the GF REST API is the confirmed next stage). Never paste a bare WordPress shortcode (`[gravityform id="1"]`) there — it only renders inside WordPress; `GravityFormEmbed` detects and warns about that mistake instead of silently failing.

## SEO / Schema

`SchemaGraph` renders one `@graph` JSON-LD block per page. `BaseLayout` always includes a `Business` node (built from `src/data/site.ts` via `lib/schema/organization.ts`); page-specific nodes (`Service`, `FAQPage`, `BlogPosting`, `Person`) reference it by `{"@id": "#business"}` rather than duplicating org info. `services.manualSchema` is an append-only escape hatch for anything the automatic nodes don't cover.

Everything else technical-SEO derives from `site.ts`'s `url` — the one place the domain is configured (`astro.config.mjs` imports it directly). Canonical/`og:url`, the title template (`"{page} | {practiceName}"`, never truncated), a sitemap (`@astrojs/sitemap`), and dynamic `robots.txt`/`llms.txt` endpoints all follow from that single value with no per-page setup. `theme-color` is parsed straight out of `tokens.css`'s `--main`. The favicon set and `public/og-default.png` ship as generic placeholders (`scripts/generate-placeholder-assets.mjs`) — **replace those files directly per client; no code change is needed.** The site ships a full JSON-LD graph, a Cloudflare Workers `wrangler.jsonc`, and a `SITE_URL` override for noindexed pre-launch previews. Full mechanics in `AGENTS.md`'s SEO section; real per-page meta descriptions and the real OG/favicon images are still a launch-time task.
