// Social-platform icon mapping. Rebuilt 2026-09-08 to use the agency's real
// IcoMoon icon font (src/styles/icon-font.css, public/fonts/icomoon.*)
// instead of inline SVG — icons are font glyphs, so color comes from the
// normal `color` cascade with no fill/currentColor wiring needed, and
// sizing comes from `font-size` rather than width/height. Class names are
// the font's real ones (see icon-font.css) — "x" maps to the font's
// "twitter" class since the font predates the platform's rename; the
// SocialIconKey/collection-facing name stays "x" either way.
import type { SocialIconKey } from "../../content.config";

export const SOCIAL_ICON_CLASSES: Record<SocialIconKey, string> = {
  linkedin: "icon-social-linkedin",
  facebook: "icon-social-facebook",
  x: "icon-social-twitter",
  instagram: "icon-social-instagram",
  tiktok: "icon-social-tik-tok",
  google: "icon-social-google",
};

export const SOCIAL_LABELS: Record<SocialIconKey, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  google: "Google",
};

// Review-platform icons for ReputationWidget's "leave a public review" stage.
// Deliberately separate from SocialIconKey above — these are review-CTA
// links (site.ts's googleReviewsLink/facebookReviewsLink/yelpReviewLink),
// not social-profile links (the socialLinks collection) — see the
// content.config.ts comment on that collection. Same icon font/source
// either way, per the icon-font.css glyph list: icon-social-yelp already
// exists in the font, just unused until now.
export type ReviewPlatformKey = "google" | "facebook" | "yelp";

export const REVIEW_ICON_CLASSES: Record<ReviewPlatformKey, string> = {
  google: "icon-social-google",
  facebook: "icon-social-facebook",
  yelp: "icon-social-yelp",
};

export const REVIEW_LABELS: Record<ReviewPlatformKey, string> = {
  google: "Google",
  facebook: "Facebook",
  yelp: "Yelp",
};
