import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

const doctors = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx,json}", base: "./src/content/doctors" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      shortName: z.string().optional(),
      bioShort: z.string().optional(), // rich text (HTML/MD) — Webflow: RichText
      bio: z.string().optional(), // rich text (HTML/MD) — Webflow: RichText
      mainImage: image().optional(),
      secondaryImage: image().optional(),
      showOnHome: z.boolean().default(false),
      imageAltText: z.string().optional(),
    }),
});

const staff = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx,json}", base: "./src/content/staff" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      position: z.string().optional(),
      image: image().optional(),
      bio: z.string().optional(), // rich text
      imageAltText: z.string().optional(),
    }),
  // NOTE: Staff's real Webflow schema is a strict subset of Doctors' — no
  // bioShort, no secondaryImage, no showOnHome. Don't assume the two are
  // identical; they aren't, in the live source (see Skeleton-Build-Spec.md §4).
});

const serviceCategories = defineCollection({
  loader: glob({ pattern: "**/*.{md,json}", base: "./src/content/service-categories" }),
  schema: z.object({
    name: z.string(), // plain text only — categories are just names
  }),
});

const blogCategories = defineCollection({
  loader: glob({ pattern: "**/*.{md,json}", base: "./src/content/blog-categories" }),
  schema: z.object({
    name: z.string(), // plain text only
  }),
});

const services = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx,json}", base: "./src/content/services" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      customName: z.string().optional(),
      serviceIcon: image().optional(),
      pageHeaderImage: image().optional(),
      contentBlocks: z
        .array(
          z.object({
            body: z.string(),
            image: image().optional(),
            // "cta": the closing booking block (body + the site's booking
            // button, no image). Standard service page (agency Webflow
            // structure): 3 text+image blocks, then one "cta" block, then FAQs.
            style: z.enum(["default", "cta"]).default("default"),
          })
        )
        .default([]),
      serviceCategory: z.array(reference("serviceCategories")).default([]),
      featured: z.boolean().default(false),
      featuredHeading: z.string().optional(),
      featuredText: z.string().optional(),
      showOnSidebarMenu: z.boolean().default(true),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      faqs: z
        .array(
          z.object({
            question: z.string(),
            answer: z.string(),
          })
        )
        .default([]),
      manualSchema: z.string().optional(),
    }),
});

// BLOG POST CONTRACT — docs/BLOG-POST-CONTRACT.md. Posts are also published by
// external automations (Zapier / Make / n8n → GitHub), so the storage is fixed
// in every fork even when the public URL changes (/blog, /resources, …):
//   posts   src/content/blog/<slug>.md      images  src/assets/blog/<file>
// Only ADD optional fields here; never rename/remove one or make one required
// (it would break every automation already publishing to the fork).
// `npm run check:posts` validates posts against this contract.
const blog = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: "./src/content/blog" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(), // post title (H1)
      pubDate: z.coerce.date(), // YYYY-MM-DD; a future date = scheduled (hidden until a build on/after it)
      draft: z.boolean().default(false), // true = never published, whatever the date
      titleTag: z.string().optional(), // SEO title (≤ 60 chars)
      metaDescription: z.string().optional(), // ≤ 160 chars
      postSummary: z.string().optional(), // card excerpt
      postThumbnail: image().optional(), // "../../assets/blog/<file>"
      thumbnailAlt: z.string().optional(),
      author: reference("doctors").optional(), // a doctors/ entry id, when a doctor wrote it
      authorName: z.string().optional(), // byline when there's no doctor author
      category: z.array(reference("blogCategories")).default([]),
      readTime: z.string().optional(), // e.g. "5 min read"
      keyTakeaways: z.array(z.string()).default([]),
      sources: z.array(z.object({ text: z.string(), url: z.string().url() })).default([]),
      featured: z.boolean().default(false),
      monthLabel: z.string().optional(), // legacy display override for the date
    }),
});

const testimonials = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx,json}", base: "./src/content/testimonials" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      testimonial: z.string(),
      image: image().optional(), // usage optional — slider/card render fine without one
      imageAltText: z.string().optional(),
    }),
});

// Direct links to the practice's own social/review profile pages — distinct
// from site.ts's googleReviewsLink/facebookReviewsLink/yelpReviewLink
// (review-platform CTAs used by ReputationWidget). "icon" names a key into
// src/lib/icons/social.ts's inline-SVG library rather than an image asset,
// so the icon can inherit color via currentColor (header/footer render it
// differently depending on scroll/theme state). See Skeleton-Build-Spec.md §6.
export const SOCIAL_ICON_KEYS = ["linkedin", "facebook", "x", "instagram", "tiktok", "google"] as const;
export type SocialIconKey = (typeof SOCIAL_ICON_KEYS)[number];

const socialLinks = defineCollection({
  loader: glob({ pattern: "**/*.{md,json}", base: "./src/content/social-links" }),
  schema: z.object({
    icon: z.enum(SOCIAL_ICON_KEYS),
    link: z.string(),
  }),
});

export const collections = { doctors, staff, serviceCategories, blogCategories, services, blog, socialLinks, testimonials };
