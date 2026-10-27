# AGENTS.md — read this before changing anything

This repo is **Skeleton**: an Astro template for veterinary-clinic websites with every functional/UX
piece already built and **no fixed visual design**. Each client gets their own fork, then a designer
(human or AI agent) restyles it. Your job in a fork is to re-skin, restructure and rewrite content
**without breaking the contract below**. Full rationale lives in the agency's `Skeleton-Build-Spec.md`
(not shipped here).

`CLAUDE.md` is a symlink to this file.

## Golden rules

1. **Never hard-code a design value.** No literal colors, no `var(--x, fallback)`, no literal
   transition durations/easings in component or page CSS. Every value comes from
   `src/styles/tokens.css`. If the design needs a value with no token, **add the token to
   `tokens.css` first** (with a one-line comment saying what it's for), then use it.
2. **Re-skinning = generating a palette into `tokens.css` Tier 1 (+ fonts).** Component markup and class
   names stay. **Generate the palette with `npm run palette` — don't hand-pick Tier 1 values.** The
   generator bakes the contrast rules in, so the result passes by construction. Change a role's
   *mapping* in Tier 2, not the components that use it.
3. **Motion is opt-in via data attributes** (see *Motion layer*). Never write per-component
   `@media (prefers-reduced-motion)` blocks — it's handled once, globally.
4. **Pages/components read content through `src/lib/data/*`**, never `astro:content` directly.
5. **Run `npm run verify` before you say you're done.** It must pass.
6. **Every `tel:` link comes from `phoneHref(site)`** (`src/lib/utils/phone.ts`), and the visible number is
   always `site.phoneNumber`. `check:links` fails if the site dials more than one number.
7. **Before a client review or launch, run `npm run check:launch`** and clear every ✖ (see *Pre-launch*).
8. **Don't change an approved page while you're working on another one.** If a site-wide change would alter
   an approved page (homepage CTAs, nav), say so and ask first.

## Commands

```sh
astro dev --background   # dev server → http://localhost:4321 (use --background; stop: astro dev stop)
npm run palette -- --main "#16253c" --cta "#008585" [--write]   # generate a contrast-safe Tier 1 palette
npm run verify           # astro check + check:posts + test:publish + check:tokens + test:palette + build + check:links — the definition of done
npm run test:publish     # tests for the publish-from-issue script (blog posts from GitHub issues)
npm run check:tokens     # token contract + palette contrast (fast; run it while styling)
npm run test:palette     # proves the generator passes every contrast rule for ~3,000 random brand colors
npm run check:links      # after a build: every internal link/asset resolves + every tel: dials one number
npm run check:launch     # client fork only: placeholder domain/assets/forms/copy, Worker name, legal pages
SHOW_SCHEDULED=1 astro dev   # preview future-dated (scheduled) blog posts locally
SITE_URL=https://<x>.workers.dev npm run build   # preview build on a non-production host (noindexed)
```

Other Astro commands: `astro dev status`, `astro dev logs`. Docs: https://docs.astro.build

## The token contract — `src/styles/tokens.css`

Three tiers. Tier 1 is a **1:1 mirror of the agency's Webflow "Base" variable collection** (same 18
variables; Webflow "Main Soft O50" ⇒ `--main-soft-o50`), so a Webflow palette pastes straight in.
Hex only: `#RRGGBB`, or `#RRGGBBAA` for translucent.

### Tier 1 — Base collection (the only tier a client re-skin edits)

| Token | Role — use it for |
|---|---|
| `--white` | page/card surface; text on dark surfaces |
| `--text` | body copy |
| `--text-muted` | captions, meta, placeholders (always lighter than `--text`) |
| `--light-grey` | neutral borders / dividers |
| `--solid-bg` | very soft brand-tinted section/card/hover background (opaque) |
| `--base-bg` | same tint at 48% — for layering over images/other backgrounds |
| `--alt-bg` | dark navy-family at 80% — dark section over an image/pattern |
| `--main` | primary brand: headings, links, primary buttons, dark sections |
| `--main-dark` | darkest brand: footer, deep sections, hover for `--main` buttons |
| `--main-light` | lighter brand: accents, focus ring, link hover |
| `--main-soft` | muted brand: subtle fills, borders on dark |
| `--cta` | **the action color**: primary call-to-action buttons |
| `--cta-hover` | CTA hover / pressed |
| `--white-o85` `--main-o50` `--main-soft-o50` | translucent siblings (same RGB as the solid token) |
| `--overlay-color` | black @50%: modal / hero image scrim |
| `--shadow` | shadow **color** only (used to build `--shadow-*`) |

How the palette hangs together (keep this when you build a new one):

- **One hue family.** `--main-dark/--main/--main-soft/--main-light` and the three backgrounds share
  the brand hue and differ only in lightness/saturation. Tinting every neutral with the brand hue is
  what makes a site look designed.
- **`--cta` is the single action color** and sits apart from that family. Buttons that ask the user
  to *do* something (book, call, submit) use `--cta`; navigation/secondary buttons use `--main`.
- **Translucent tokens are twins of a solid token** — don't invent a new hue for an overlay.

### Generating a client palette — `npm run palette`

Colors are generated fresh for every new design, so the generation step guarantees contrast instead of
hoping a hand-picked palette happens to pass:

```sh
npm run palette -- --main "#<logo's main color>" --cta "#<logo's accent color>"            # preview
npm run palette -- --main "#<logo's main color>" --cta "#<logo's accent color>" --write    # update tokens.css
```

Two sources of rules, kept distinct (details in `scripts/lib/generate.mjs`):

- **From the agency's `webflow-prelaunch-colors` skill (unchanged):** `--main` and `--cta` are the
  exact logo colors; `--main-dark` = HSL lightness −25 (skill range −20…30; floored at L5);
  `--main-light` = +25; `--main-soft` = desaturate 40% and +15; `--cta-hover` = the skill's
  "cta_dark" (−21, floored at L5); the `-o50` tokens = the solid hex + `80`.
- **New additions for this repo:** `--text` = `#333333`; `--solid-bg` = brand hue, low saturation, L96;
  `--base-bg` = the same tint at L93 and 48% alpha; `--alt-bg` = brand hue at L≈21 and 80% alpha;
  `--text-muted` = the brand hue at the *lightest* lightness that still clears 4.6:1 on white,
  `--solid-bg` and `--base-bg` (so it is always visibly lighter than `--text`). A neutral (gray)
  brand stays neutral — no tint is invented.

What the generator will change, and always reports (lightness only — hue and saturation are kept):

- `--main` is darkened if headings, links or white-on-main would fall under 4.5:1 on white or the soft
  backgrounds. `--main-light` is capped so it stays readable as text on those surfaces.
- `--cta` is nudged until its button text reaches 4.5:1. If the brand accent is inherently too light
  for that (more than an 8-point shift), the button text switches to `--main-dark` instead (`--on-cta`
  is updated) and `--cta-hover` goes lighter — the accent keeps its brand color.

The same rules are carried by the agency's `webflow-prelaunch-colors` skill for **Template V2.55** (13 Base variables; Steps 3A/3B), so a Webflow site and a Skeleton site generated from the same logo get the same palette — keep the two in sync (a rule changed in `scripts/lib/generate.mjs` must be changed in the skill, and vice-versa).

After `--write`, run `npm run check:tokens`. Never hand-edit a Tier 1 value afterwards without
re-running it: contrast is only guaranteed for generated values.

### Tier 2 — semantic roles (map to Tier 1; re-point these, not components)

`--heading` (→ `--main`) · `--on-main` (→ `--white`) · `--on-cta` (→ `--white`) · `--focus-ring`
(→ `--main-light`) · `--header-bg` / `--header-fg` (header state; `Header.astro` swaps them on scroll) ·
`--footer-bg` / `--footer-text` / `--footer-heading` / `--footer-border`.

### Tier 3 — scales (one value per name)

- Spacing `--space-2xs … --space-2xl` · type `--font-body`, `--font-heading`, `--font-size-xs … 4xl`
  (loaded by `src/styles/fonts.css` — reference is Inter, self-hosted via `@fontsource`; swap the font
  by installing a different `@fontsource/<family>` package, see that file's own header comment)
- Radius `--radius-sm/md/lg` · shadows `--shadow-header/-card/-dropdown/-float/-callbar`
- Containers `--container-max`, `--container-max-narrow`
- Layout dimensions other components depend on: `--header-height`, `--callbar-height`,
  `--logo-height`, `--page-header-height`, `--reviews-pill-left`
- Third-party brand colors (fixed, never re-skin): `--brand-google/-facebook/-yelp`, `--star`
- Motion: `--motion-duration-fast/base/slow/reveal`, `--motion-ease`, `--motion-ease-out`,
  `--motion-distance`, `--motion-stagger`

**Breakpoints can't be variables inside `@media`.** They are the literals `900px` (nav / callbar /
footer switch) and `767px` (narrow). Reuse those exact values.

### Which token for which job

| Job | Use |
|---|---|
| Page/card background | `--white` |
| Alternating / soft section, hover background | `--solid-bg` (over imagery: `--base-bg`) |
| Dark section | `--main-dark` (over imagery: `--alt-bg`) |
| Body text / muted text / headings | `--text` / `--text-muted` / `--heading` |
| Text on dark | `--white` (footer: `--footer-text`) |
| Link | `--main` (hover `--main-light`) |
| Primary action button | bg `--cta`, text `--on-cta`, hover `--cta-hover` |
| Secondary button | bg `--main`, text `--on-main`, hover `--main-dark` |
| Border / divider | `--light-grey` (on dark: `--footer-border` / `--main-soft`) |
| Image scrim | `--overlay-color` (tinted: `--main-o50`) |
| Elevation | `--shadow-card` / `--shadow-dropdown` / `--shadow-float` |

### Contrast rules (enforced by `check:tokens`)

Body, muted, heading, link, link-hover, on-main, **CTA button text (and on hover)**, footer text and
the focus ring must all pass WCAG AA (4.5:1; ring 3:1) — computed from the real hex values, including
on `--solid-bg` and the exact composite of `--base-bg` over white. These are hard errors, not
warnings; the rules live in `scripts/lib/palette.mjs` and are shared by the checker and the generator.

Still your call (no rule can cover it): **don't use `--cta` as *text* on a dark `--main` section** — a
CTA hue is usually close to the brand hue, so the text version has weak contrast (the reference teal on
navy is ~3.4:1). Use a `--cta` *button* with `--on-cta` text instead.

## Motion layer

Opt-in, design-neutral, token-driven. Nothing moves until an element opts in. Booted once by
`src/components/MotionLayer.astro` (mounted in `BaseLayout`'s `<head>`); styles in `src/styles/motion.css`.

```html
<section data-reveal>                       <!-- fade + rise on scroll (default) -->
<div data-reveal="left|right|up|down|fade|scale" data-reveal-delay="200">
<ul data-reveal-stagger>                    <!-- children enter one after another -->
  <li data-reveal>…</li><li data-reveal>…</li>
</ul>                                       <!-- data-reveal-stagger="120" sets the ms step -->
<a href="…" data-hover="underline">         <!-- hover/focus: lift | scale | underline -->
<div data-animate="fade|pop">               <!-- plays when the element renders -->
```

Rules:

- Timings/easing/distance come from the `--motion-*` tokens. Need a different feel? Change the tokens.
- **Don't put `data-reveal` on an ancestor of a `position: fixed` element** (a transform would trap it),
  and don't reveal anything above the fold that must be visible immediately (hero content).
- The controller **removes `data-reveal` after an element finishes revealing**, so it can't fight your
  hover styles. Don't select on `[data-reveal]` for anything permanent.
- No-JS, `prefers-reduced-motion`, and a 4-second failsafe all leave content fully visible. Keep it so.
- Modals already animate (`motion-fade-in` / `motion-pop` keyframes, global). Reuse those keyframes.
- New transition in a component? `transition: transform var(--motion-duration-base) var(--motion-ease)`.
  A literal `0.2s` or `cubic-bezier(...)` fails `check:tokens`.

## Forms — `src/data/forms.ts`

`GravityFormEmbed` renders whatever's in `gravityFormEmbeds[formId]` — an iframe pointing at a WP page
hosting the client's real GF form (stage 1; a native form UI on the GF REST API is the confirmed next
stage, not built yet — `Ideas.md` idea #2). **Never paste a bare WordPress shortcode**
(`[gravityform id="1"]`) here — it only renders inside WordPress and `GravityFormEmbed` detects and
warns about it instead of silently showing broken text. If a snippet ever needs a `<script>` tag (a
JS-widget embed instead of a plain iframe), it's re-created via the DOM API automatically — `set:html`
alone never executes an injected `<script>`, a browser rule, not something to work around per-snippet.

Paste GF's embed code as-is: `GravityFormEmbed` rewrites protocol-relative (`src="//…"`) and `http://` URLs
to `https://`. **Ask for every form embed at intake, in one go**: one per `formId` in use (contact, which
the page and the site-wide modal share; appointment/booking; reputation-feedback, the "didn't like it"
form inside How'd We Do?; plus any page-specific form). `check:launch` fails while any is missing. Never
submit a client's live form to test it; they are real inboxes.

## SEO — all of it derives from `site.ts`'s `url`

`astro.config.mjs` imports `src/data/site.ts` directly and sets Astro's `site` from its `url` field —
**the only place the domain is configured.** Everything else follows automatically, per-page props are
rarely needed:

- **Canonical / `og:url`** — auto-derived from the current URL in `BaseLayout`. Don't pass `canonical`
  unless a page genuinely needs a different one (rare).
- **Title** — pages pass a short segment (`title="Contact Us"`); `BaseLayout` appends
  `" | {practiceName}"`, **omitted (never truncated)** if that would exceed 60 characters — the
  `webflow-prelaunch-meta` skill's own rule. Pass `titleTemplate="full"` only if a page composes its
  own complete title (the homepage is the one example).
- **OG/Twitter image** — every collection detail page passes its cover image
  (`ogImage={entry.data.pageHeaderImage}`, an `ImageMetadata`) plus `ogImageAlt`; `BaseLayout` crops it to a
  1200×630 JPEG and emits `og:image:width/height/alt`. Every other page falls back to
  `public/og-default.png`, which **must be 1200×630** and keeps that name/path: swap the file, not the code.
- **Favicon** — `public/favicon.png` (32×32), `favicon.ico`, `apple-touch-icon.png` (180×180). **PNG only; no
  `favicon.svg`.** Browsers prefer an SVG icon, so a leftover placeholder SVG hid a client's real PNG once.
  Swap the files in place. `scripts/generate-placeholder-assets.mjs` overwrites them and refuses to run
  without `--force`; never run it in a client fork.
- **Share previews only work on a public URL that serves the build.** Before DNS moves to the new site,
  `site.ts`'s `url` still points at the client's old site, so a shared link shows the old site's image or
  none. For a pre-launch review link, build with `SITE_URL=https://<worker>.workers.dev` (a Cloudflare
  build variable). That build is automatically `noindex` and `robots.txt` disallows everything. Remove
  `SITE_URL` at launch.
- **`theme-color`** — parsed straight out of `tokens.css`'s `--main` at build time. Never set it
  separately; if it's wrong, `--main` is wrong.
- **Sitemap / `robots.txt` / `llms.txt`** — all three are generated on every build, from the real
  pages and content, so they are never edited by hand and never go stale:
  - **`/sitemap.xml`**: `@astrojs/sitemap` lists every built route; `singleSitemap` in
    `astro.config.mjs` merges it into one `/sitemap.xml` and leaves out any page that is `noindex`
    or a redirect (and the 404). `sitemap-index.xml` / `sitemap-0.xml` are also emitted; ignore them.
  - **`/robots.txt`** (`src/pages/robots.txt.ts`): allows crawling and points to `/sitemap.xml`;
    on a preview build (`SITE_URL`) it disallows everything instead.
  - **`/llms.txt`** (`src/pages/llms.txt.ts`): business summary, pages, services, published posts
    and FAQs for AI assistants.

  **When they update:** on every build, i.e. every push to `main` (Cloudflare rebuilds), plus the
  weekly `scheduled-publish.yml` rebuild that releases scheduled posts. So:
  - **New page** (`src/pages/…`) or **new service / doctor / category**: in the sitemap on the next
    deploy. Nothing to do. To keep a page out, give it `noindex` (`<BaseLayout noindex>`).
  - **New blog post**: in the sitemap and llms.txt on the first build on/after its `pubDate`;
    `draft: true` posts never appear. The weekly rebuild needs the repo secret `DEPLOY_HOOK_URL`,
    or scheduled posts only appear on the next push.
  - **Retired page**: add a redirect in `astro.config.mjs`; redirects are left out automatically.
  - `npm run check:links` (part of `verify`) fails if `sitemap.xml` and the built pages disagree.
  - After launch, submit `https://<domain>/sitemap.xml` once in Google Search Console; Google
    re-reads it on its own after that.
- **Description** — still real copy at launch (not generated); a page with none gets a generic
  fallback sentence rather than shipping empty.

## Structured data (JSON-LD) — `src/lib/schema/organization.ts`

Every page gets one `@graph`, assembled by `BaseLayout`: **WebSite** (with a SearchAction) + **Business**
(`site.businessSchemaType`; address, `areaServed`, hours, `sameAs`, booking `ReserveAction`) + this page's
**WebPage** + **BreadcrumbList** + whatever the page passes as `schemaGraph`.

- Write short `@id`s; `normalizeIds()` makes them absolute. `#website` / `#business` → site root;
  any other `#name` → this page (`#service`, `#faq`, `#person`, `#article`); `/other/page#name` → another
  page's node (a blog post's author is `/doctors/<slug>#person`). Never hand-write a full URL `@id`.
- Page props: `webPage={{ "@type": "AboutPage" }}` or `webPage={{ mainEntity: { "@id": "#service" } }}`
  adjusts the WebPage node; `breadcrumb="Label"` sets the last crumb (`false` disables it). Segment names
  and targets for pages without an index (`/doctors` → Meet the Team) are in `SEGMENTS` there.
- Business facts come only from `site.ts`: set `businessSchemaType`, `businessDescription`,
  `serviceAreaOfCoverage` (becomes `areaServed`), `openingHoursSpecification`,
  `addressLocality/Region/postalCode`. FAQ answers are plain text in schema (`stripHtml`).
- Check a changed page by parsing its built `<script type="application/ld+json">`: every `@id` reference
  must match a node's `@id` exactly (trailing slashes included).

## Client intake — confirm these before building

Each of these was once caught by the client or PM after the build instead of being set up front:

| Confirm | Where it goes |
|---|---|
| **Business type.** Clinic, mobile vet, or not a vet at all (trainer, groomer, boarding)? | `businessSchemaType`, `mobileVet`, `serviceAreaOfCoverage`, `businessDescription`; also the vet wording in default copy (see *Copy rules*) |
| **Publish the street address?** Home-based or mobile businesses usually don't | `showStreetAddress` (defaults to hidden when `mobileVet`) |
| **Canonical domain, apex or `www`**, and when DNS moves | `site.ts` `url` (the other one redirects) |
| **Display number and call-tracking number** | `phoneNumber` (shown), `callTrackingNumber` (dialed) |
| **Booking action**: the page or scheduler every "book" CTA leads to, and its label | `bookingUrl`, `bookingLabel` |
| **All Gravity Forms embeds** (see *Forms*) | `src/data/forms.ts` |
| **Review and social links**: Google review URL with tracking parameters stripped, Instagram, etc. | `googleReviewsLink`…, `src/content/social-links/` |
| **Brand files**: color logo, white/reversed logo, favicon PNGs, 1200×630 OG image | `public/` (see *SEO*); if there's no white logo, derive one from the color logo |
| **Client-supplied copy**: FAQs, service copy, bios | used word for word; it always beats generated or doc copy |

Client source files (copy docs, intake exports, `.docx`/`.pdf`) go in `client-docs/` in the repo root,
which is gitignored with root-level `*.docx` / `*.pdf`. **Never commit them.**

## Phone numbers and address

- `site.phoneNumber` is the only number shown; `site.callTrackingNumber` is the only number dialed. Use
  `phoneHref(site)` for component links and `withTrackingPhone(html, site)` for rich-text content that may
  contain `tel:` links (service blocks, FAQ answers). Never build `tel:` by hand, and never *display* the
  tracking number.
- Address privacy is enforced once in `getSiteInfo()`: when the street isn't public, `address`,
  `addressLink` and `mapEmbedLink` come back `undefined`, so no component, page or schema node can leak
  them. City/ZIP (`addressLine2`, `addressLocality`…) stay. Always read site data through `getSiteInfo()`.

## Service pages — the standard structure

Every service gets its own page (`/services/<slug>`), never an anchor on a list page. Content follows the
agency's Webflow service template:

1. `contentBlocks`: **3 text + image blocks** (what it is / why it matters; what to expect; who it's for).
   Blocks alternate sides automatically.
2. A closing block with **`style: "cta"`**: short copy; the site's booking button is added automatically.
3. **5 FAQs**, researched and specific to the service, with a source for any factual claim. They render as
   an accordion plus `FAQPage` schema.
4. `metaTitle`, `metaDescription`, `pageHeaderImage` (it's also the page's share image).

`check:launch` warns about any service with fewer than 5 FAQs or no `cta` block. Mark agent-written copy
as a draft for the client in your hand-off; never present it as the client's own.

## Blog — storage contract (automation-safe)

An external automation (Make / n8n → a GitHub issue → the `publish-from-issue` Action) publishes posts to client repos, so blog
storage is identical in every fork: **posts in `src/content/blog/<slug>.md`, images in
`src/assets/blog/`**, frontmatter per `docs/BLOG-POST-CONTRACT.md`, validated by
`npm run check:posts` (part of `verify`, and run by `check-posts.yml` on every push to `main`
that touches the blog). The same check **enforces the structure itself**: it fails if either folder
is missing, the `blog` loader stops being `*.{md,mdx}` in `./src/content/blog`, or a contract field
is removed or renamed from the schema. Automations publish straight to `main` (no branch, no review).

- **Never move or rename those folders or the `blog` collection**, even when the site calls it
  "Resources". Rename the public route instead: rename `src/pages/blog/` and change `BLOG_BASE`
  in `src/lib/data/blog.ts`; every link, breadcrumb and llms.txt entry follows it.
- **Schema changes are additive only:** a fork may add optional fields, never rename/remove a
  contract field or make an optional one required.
- Build post links with `postHref(post)` / `BLOG_BASE`, never a hard-coded `/blog/`.
- **Blog posts arrive through publish-from-issue. Don't edit the workflow or script in a site repo;
  change the template and copy.** (`.github/workflows/publish-from-issue.yml`,
  `scripts/publish-from-issue.mjs` + its test and `scripts/fixtures/publish/`, `.gitattributes` are
  byte-identical in every site.)

## Blog — scheduled publishing

- A post with `draft: true` is never published. A post with a future `pubDate` is a **scheduled draft**: `src/lib/data/blog.ts` leaves it out of every
  page, the sitemap, search and llms.txt until the first build after that date. Preview drafts with
  `SHOW_SCHEDULED=1`.
- The site is static, so something must rebuild on release day:
  `.github/workflows/scheduled-publish.yml` POSTs the repo secret `DEPLOY_HOOK_URL` weekly. Match its cron
  weekday to the posts' `pubDate`s. Without the secret, the job skips.
- Content may link ahead to a scheduled post: run rich text through `unlinkScheduledArticles()` and the
  link renders as plain text until the post is live. Service pages already do this.
- Listing pages: a featured post shown on its own must be excluded from the grid below it, and a category
  filter with no live posts must not render.

## Deploy — Cloudflare Workers

`wrangler.jsonc` ships with the template: static assets from `./dist`, `404-page` not-found handling, and
`auto-trailing-slash`. Per client:

- Set `"name"` to the **exact Worker name in the Cloudflare dashboard**. A mismatch (or a missing
  `wrangler.jsonc`) leaves the connected Worker serving Cloudflare's "Hello World" stub.
- Git-connected Workers Builds: build command `npm run build`, deploy command `npx wrangler deploy`.
  Every push to `main` builds and deploys; nothing to run locally.
- Pre-launch review link: see `SITE_URL` under *SEO*.

## Copy rules

- **Headings talk to the reader about their goal**, never about the page or the site ("Why We Built This
  Page" was rejected). An owner-facing page heading states what the reader gets.
- **Per-page CTA targets are a decision, not a default.** The About page links only to services and the
  booking action (no phone button); ask when a page's CTA destination isn't specified.
- **The template's vet wording is a default, not a fact.** For a non-clinic client, replace "Veterinary",
  "Dr.", "patients", "New Patient Forms", "For Pet Owners" in page copy, nav labels, `BaseLayout`'s fallback
  description and the homepage title, and redirect retired routes (`redirects` in `astro.config.mjs`).
- **Research-based content cites its sources** (FAQs, articles). Don't invent statistics.
- The About dropdown's items (Meet the Team, Photo Gallery, How'd We Do?) are a fixed slot; a redesign may
  restyle or rename them, not drop them. How'd We Do? is the only way to open the reputation widget.

## Pre-launch — `npm run check:launch`

Run in the client fork before sending the site for review and before DNS moves. It fails (✖) on: a
placeholder domain or business details; placeholder favicon or OG image; a `favicon.svg`; a missing form
embed; the Worker still named `skeleton`; placeholder content copy; the privacy policy's effective-date
placeholder. It warns (!) on things to confirm: business type, street address, no tracking number, logos,
FAQs under 5, placeholder Terms of Use, and `SITE_URL` still set.

The **Privacy Policy is a default policy** (analytics and marketing tracking; information used to answer
inquiries; never sold), filled from `site.ts`. Set its `effectiveDate`. The client's own policy, if they
have one, always replaces it. **Terms of Use** are never written by an agent; they must come from the client.

## Architecture map

```
src/styles/tokens.css      THE token contract (above)         src/styles/motion.css   motion primitives
src/styles/icon-font.css   agency IcoMoon font — codepoints tied to the font file; don't renumber
src/data/site.ts           per-client singleton: name, phone, hours, review links, logos, footer blurb,
                           and `url` — the domain, read by astro.config.mjs (see SEO above)
src/content/*              8 collections: doctors, staff, services, service-categories, blog,
                           blog-categories, testimonials, social-links   (schemas: content.config.ts)
src/lib/data/*             accessor layer — the ONLY way pages/components read content
src/lib/schema/            JSON-LD: site graph + WebPage/Breadcrumb + @id normalization (see Structured data)
src/lib/utils/phone.ts     phoneHref / withTrackingPhone — the only way to build a tel: link
wrangler.jsonc             Cloudflare Workers deploy config — rename "name" per client
.github/workflows/         scheduled-publish.yml — weekly rebuild that releases scheduled posts
src/components/            component library, BEM-named (default scaffold, not a hard rule)
src/layouts/BaseLayout     chrome: head (SEO, schema), header, footer, callbar, global modals, motion, a11y
src/pages/robots.txt.ts    dynamic endpoints (not static public/ files) — see SEO above
src/pages/llms.txt.ts
src/pages/                 20 HTML routes (static + [slug] per collection); scripts/  the checkers
public/og-default.png      placeholder OG/Twitter image — swap the file, not the code (see SEO above)
public/favicon.*           placeholder favicon set (PNG + ICO, no SVG) — same swap-in-place model
```

Per-client fork workflow: intake (see *Client intake*) → `site.ts` (incl. `url`) → `tokens.css` (Tier 1 +
fonts) → content in `src/content/` → images (`src/assets/`, `<Image>` from `astro:assets`) →
`public/og-default.png` + `public/favicon.*` (swap in the real files) → `forms.ts` → `wrangler.jsonc` name →
restyle components → `npm run verify` → `npm run check:launch`.

## CSS conventions

- Scoped `<style>` per component; BEM (`.block__element--modifier`). New dark-background sections must
  set `color: inherit` on their headings (base rule: `:where(h1…h6) { color: var(--heading) }`).
- Logical properties (`margin-inline`, `inset-block-start`, `padding-block`) — match the surrounding code.
- Global styles live only in `BaseLayout.astro`'s `<style is:global>` and `styles/*.css`.

## Gotchas (each cost real debugging time)

- **UserWay widget** applies its own `transform` alongside `left/right`; overrides need
  `transform: none !important` (desktop) / `translateX(-50%)` (mobile). Its mobile `bottom` offset is
  derived from the callbar call-circle geometry — if the circle's size/raise changes, **re-measure with
  `getBoundingClientRect`, don't recompute by hand** (a negative margin on a `justify-content:center`
  flex child moves it by half its value).
- **Modal**: scroll/max-height lives on `.modal__body`, not `.modal__dialog`, but slotted content is
  *inside* `.modal__body`, so its `overflow: auto` still clips anything that sticks out. `ReputationWidget`
  therefore sets its own modal body to `overflow: visible` and scrolls an inner `.reputation-widget__content`.
  Do the same for any modal with content that must overflow the card. The mascot's `top`/`left` are tuned
  to the shipped 350×271 images (body edge on the dialog border, paws over it); re-tune if you swap them.
- **Fixed/glass header over light sections**: a translucent header that reads fine over the dark hero can
  wash out over white sections. Check the scrolled state over the lightest section on every page.
- **Phone numbers and short codes must not wrap**: give them `white-space: nowrap`, and check contact cards
  at 360px width. Large display headings also need a check at 360px (long words overflow).
- **Editing through shell heredocs mangles backslashes**: `[^\d+]` became `[^d+]`, `\n` became a real line
  break. Use the Edit/Write tools, or a script file, for anything containing a regex or escape.
- **Line endings**: working copies are CRLF (`core.autocrlf`), the index is LF. A script that matches
  multi-line strings must normalize `\r\n` first (and write back what it read).
- **Anchors** need an explicit `color`; the browser default (blue/purple) otherwise beats inheritance.
- **`Header`** toggles `.is-scrolled` from JS; it re-points `--header-bg/--header-fg`. Anything you add
  to the header must read those tokens to survive the transparent → white swap.
- **Astro `<script>`** is bundled/deferred (fine); `is:inline` runs immediately (used for the
  pre-paint motion flag). Astro doesn't scope `@keyframes`, so motion keyframes are global by design.
- Headless/background browser tabs don't render frames, so `IntersectionObserver` reveals won't fire
  until something paints — take a screenshot before concluding a reveal is broken.
- **Astro scoped `<style>` does not reach content passed through `<slot/>`** — slotted markup keeps its
  *parent's* scope hash, never the child component's, so a plain `.section--dark h2 {}` written inside
  a wrapper component silently matches nothing. Wrap the descendant part in `:global()`:
  `.section--dark :global(h2) {}` (the ancestor class stays scoped correctly). `Section.astro`'s
  heading/link/form-control color fix is the real example — confirmed broken without `:global()`,
  fixed with it, via `getComputedStyle` in a browser, not just reasoning about specificity.
- **Form controls don't inherit `color`/`font`** — `button`/`input`/`select`/`textarea` get an explicit
  UA-stylesheet color that beats inheritance, unlike a normal element. A dark-background wrapper needs
  `button, input, select, textarea { color: inherit; }` explicitly, or a slotted `<button>` renders in
  the browser's default black regardless of its container's color.
- **A content-collection `image()` field can reference an asset outside its own entry's folder** — e.g.
  `src/content/doctors/dr-example.md`'s `mainImage: "../../assets/avatar-generic.png"` — and it still
  goes through normal `astro:assets` optimization. Confirmed, not assumed (checked `astro build`'s real
  output first). Means one shared placeholder can back many entries instead of a near-duplicate each.
- **A long-running `astro dev` doesn't always pick up a brand-new `src/assets/` directory or new
  content-collection frontmatter fields added while it's running** — images rendered as empty boxes in
  dev despite a correct static `astro build`. `astro dev stop` + `astro dev --background` fixed it.
  If something looks broken only in dev, diff it against a fresh `astro build` before assuming a bug.
- **Verify images by sampling actual rendered pixels (`canvas.getImageData` on the `<img>`), not by
  eyeballing a screenshot or trusting `getComputedStyle` alone.** Twice in one session a screenshot
  looked like a missing image when the element was in fact loaded and correctly positioned — once
  below the captured viewport, once too subtly visible against a dark overlay at screenshot resolution.
  A pixel sample settles it in one call instead of a guess.

## Definition of done

`npm run verify` passes (0 type errors, token contract holds, 28+ pages build, 0 broken links, one `tel:`
number), and you looked at the affected pages in a browser at desktop **and** ≤ 900px width (and 360px for
anything with large type or phone numbers). Before a client review or launch, `npm run check:launch` passes
too.
