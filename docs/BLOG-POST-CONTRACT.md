# Blog Post Contract

The one format every Skeleton site accepts for blog posts, whether a person writes the post or
an automation (Zapier, Make, n8n, a custom script) publishes it through the GitHub API. It is
the same in every client repo, even when the site calls the blog "Resources", "Articles" or
anything else. Only the public URL changes; the files never move.

`npm run check:posts` validates every post against this contract (it's part of `npm run
verify`, and `.github/workflows/check-posts.yml` runs it on every pull request that touches posts).

## Where things go

| What | Path in the repo | Rules |
|---|---|---|
| Post | `src/content/blog/<slug>.md` | One file per post, directly in that folder (no sub-folders). |
| Post image | `src/assets/blog/<slug>.<ext>` | `.jpg`, `.png`, `.webp` or `.avif`; ideally ≥ 1600 px wide; the site resizes and crops it. |
| Categories | `src/content/blog-categories/<id>.md` | Posts can only use ids that exist here. |

**`<slug>`** is the post's URL name: lowercase letters, digits and single hyphens, e.g.
`hot-pavement-miami-dog-walks`. It must be unique; re-using a slug overwrites that post.

The public URL is `<BLOG_BASE>/<slug>`, where `BLOG_BASE` is set in `src/lib/data/blog.ts`
(`/blog`; MK9 labels it "Resources" on screen, but its URL is `/blog` too). Automations never need it.

## The file

```markdown
---
name: "Hot Pavement and Miami Walks: Protecting Your Dog's Paws"
pubDate: 2026-11-26
draft: false
titleTag: "Hot Pavement & Dog Paws: Miami Walking Guide"
metaDescription: "At 77°F air, asphalt can reach 125°F. The 7-second test and the safest walk times."
postSummary: "Miami pavement gets hotter than the air. Here's how to keep your dog's paws safe."
postThumbnail: "../../assets/blog/hot-pavement-miami-dog-walks.jpg"
thumbnailAlt: "Dog walking on a shaded park path"
authorName: "MK9 Specialists"
category: ["miami-dog-life"]
readTime: "4 min read"
keyTakeaways:
  - "At an air temperature of 77°F, asphalt can reach 125°F. [1]"
sources:
  - text: "Washington State University (2017). Protect pets' feet from heat."
    url: "https://archive.news.wsu.edu/press-release/2017/07/06/protect-pets-feet-from-heat/"
featured: false
---

Opening paragraph. No `#` heading here: the title comes from `name`.

## First section

Text with a citation.<sup class="cite"><a href="#source-1">[1]</a></sup>
```

## Fields

| Field | Required | Type / format | Notes |
|---|---|---|---|
| `name` | **yes** | text | The title (page H1). |
| `pubDate` | **yes** | `YYYY-MM-DD` | A future date = scheduled: hidden until the first build on or after that day. |
| `draft` | no | `true` / `false` (default `false`) | `true` = never published, whatever the date. Use it for posts waiting on approval. |
| `titleTag` | no | text ≤ 60 chars | Google title; falls back to `name`. |
| `metaDescription` | no (expected) | text ≤ 160 chars | Google description. |
| `postSummary` | no | text | Card excerpt on the listing page. |
| `postThumbnail` | no (expected) | `"../../assets/blog/<file>"` | Must exist in `src/assets/blog/`. Upload the image first. |
| `thumbnailAlt` | with an image | text | Describe the image. |
| `author` | no | a `src/content/doctors/` id | Only when a doctor wrote it; links to their page. |
| `authorName` | no | text | Plain byline when there's no doctor author. |
| `category` | no | list of category ids | Ids must exist in `src/content/blog-categories/`. |
| `readTime` | no | text, e.g. `"5 min read"` | |
| `keyTakeaways` | no | list of text | Shown as a summary box where the design has one. |
| `sources` | no | list of `{ text, url }` | `url` must be `http(s)`. Cite as `[n]` in the body. |
| `featured` | no | `true` / `false` | Highlights the post on the listing page. |

A client site may add its own **optional** fields (MK9 adds `relatedProgram`,
`relatedInsightAnchor`, `reviewedBy`). No site may rename or remove a field above or make an
optional one required: that would break every automation already publishing to it.

## Body

Markdown. Sections start at `##` (`###` for sub-sections). Links, lists, bold/italic, and inline
HTML for citations (`<sup class="cite"><a href="#source-1">[1]</a></sup>`) are fine. No `#` H1,
no `<script>`, no inline styles. Link to other posts with `<BLOG_BASE>/<slug>`; a link to a
post that isn't live yet shows as plain text until it is.

## Publishing flow (for automations)

Automations don't write files. They **open a GitHub issue** in the client's repo, and the
`publish-from-issue` Action (`.github/workflows/publish-from-issue.yml` +
`scripts/publish-from-issue.mjs`, identical in every site) turns it into the post and its image,
checks and builds the site, commits both files to `main` in one commit and reports back on the
issue. Cloudflare deploys the push. No branch, no pull request, no review step.

### The issue

`POST https://api.github.com/repos/Apex-Veterinary-Marketing/<github_repo>/issues` with the
header `Authorization: Bearer <publisher's token>` and:

- `title`: the post title (for humans; the Action uses `name`).
- `labels`: `["blog-post"]` (optional; the Action doesn't depend on it).
- `body`: a fenced `json` block, then a `## Body` heading, then the post in Markdown:

````markdown
```json
{
  "slug": "summer-heat-safety-for-dogs",
  "name": "Summer Heat Safety for Dogs",
  "pubDate": "2026-10-07",
  "draft": false,
  "titleTag": "Summer Heat Safety for Dogs | Farr West Animal Hospital",
  "metaDescription": "How to spot heatstroke early and keep walks safe on hot days.",
  "postSummary": "Hot pavement and humid afternoons are hard on dogs. Here's what to watch for.",
  "image_url": "https://<allowed-host>/path/image.jpg",
  "thumbnailAlt": "Dog resting in the shade on a summer lawn",
  "authorName": "Farr West Animal Hospital",
  "readTime": "4 min read",
  "keyTakeaways": ["..."],
  "sources": [{ "text": "...", "url": "https://..." }],
  "featured": false
}
```

## Body

Opening paragraph...

## First section

...
````

**Required:** `slug`, `name`, `pubDate`, `image_url`, `thumbnailAlt` and a non-empty body.
Every other key is optional and is the [field](#fields) of the same name. `postThumbnail` is
set by the Action from `image_url`. Unknown keys are ignored and listed in the success comment.

**Vet sites don't use blog categories:** the Action ignores `category`. (The field stays in the
contract for sites whose existing posts already have categories.)

### What the Action checks

- The issue author must be listed in the org variable `BLOG_PUBLISHERS`; any other issue is
  ignored without a comment.
- `slug`: lowercase letters, digits and single hyphens, at most 80 characters, and not already
  published.
- `pubDate`: `YYYY-MM-DD`, **the day the issue is opened** (UTC) or earlier. The commit is the
  release, so a future date is rejected. (A hand-written post may still use a future date to
  schedule itself.)
- `titleTag` over 60 / `metaDescription` over 160 characters: trimmed at a word boundary, with a
  warning in the comment.
- `sources[].url`: `http(s)`.
- Body: no `<script>`, `<iframe>`, `style=`, HTML event handlers (`onclick=`…) or `javascript:`
  links. A leading `# Title` line is dropped and any other `#` heading becomes `##`.
- `image_url`: `https`, a host listed in the org variable `BLOG_IMAGE_HOSTS`, an image, at most
  15 MB. Saved as `src/assets/blog/<slug>.jpg` (at most 2000 px wide).
- Then `npm run check:posts` and the site's own `npm run build` must pass.

### What comes back on the issue

| Outcome | Comment | Label | Issue |
|---|---|---|---|
| Published | The live URL (`siteInfo.url` + `BLOG_BASE` + `/<slug>/`, the canonical form with its trailing slash), live after Cloudflare deploys, usually a few minutes. Draft posts never show. | `published` | closed |
| Failed | What's wrong and how to fix it (plus the last 40 lines of output if the build failed). | `publish-failed` | stays open: **edit the issue to retry** |
| Duplicate slug | "Already published at …". Updating an existing post isn't supported yet. | `publish-duplicate` | closed |

`main` only changes with the final commit (`Blog: publish <slug> (#<issue>)`), so a failed
issue leaves the site untouched. Each issue runs one at a time, and an issue that's already
closed or labelled `published` is skipped. Different issues can run side by side; if `main`
moved in the meantime, the Action rebases and retries.

Test an issue body locally, without GitHub:
`node scripts/publish-from-issue.mjs --dry-run --body-file issue.md --image-file photo.jpg`.

Safety net: `check-posts` also runs on every push to `main` that touches the blog (hand-made
commits included), and Cloudflare's build fails the same way, so the live site keeps its last
good version until a broken post is fixed or removed.
