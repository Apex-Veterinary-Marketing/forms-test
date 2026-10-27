// Site-wide config — NOT a content collection. Webflow models this as two
// CMS collections (Practice Information, Practice Social Links) but both
// are effectively singletons, not repeatable content. See
// Skeleton-Build-Spec.md §4.2. Per-client values get filled in here (or in
// a sibling .json this module imports) during client intake.
//
// NOTE (2026-09-08): direct social-profile links used to live here as a
// plain array (`socialLinks`). They're now their own real content
// collection (src/content/social-links/, accessed via
// getAllSocialLinks()) so each platform's icon renders from the inline-SVG
// library in src/lib/icons/social.ts instead of a name string — see
// content.config.ts. googleReviewsLink/facebookReviewsLink/yelpReviewLink
// below are a different thing (review-platform CTA links used by
// ReputationWidget), unaffected by that move.

export interface SiteInfo {
  practiceName: string;
  // The number SHOWN everywhere. Every tel: link dials callTrackingNumber when
  // set, else this — always build links with phoneHref() from
  // src/lib/utils/phone.ts, never by hand (check:links enforces one number).
  phoneNumber?: string;
  callTrackingNumber?: string; // e.g. "+18635914728" — dialed, never displayed
  email?: string;
  address?: string; // street line — see showStreetAddress
  addressLine2?: string; // "City, ST 00000"
  addressLocality?: string; // city, for the schema PostalAddress
  addressRegion?: string; // state, e.g. "FL"
  postalCode?: string;
  addressLink?: string;
  // Publish the street address? Defaults to true, or to FALSE when mobileVet
  // is true (a mobile/home-based business usually works from a private home).
  // When false, getSiteInfo() drops address, addressLink and mapEmbedLink, so
  // no component, page or schema node can leak it; city/ZIP stay.
  // Confirm with the client at intake — never publish a home address by default.
  showStreetAddress?: boolean;
  mobileVet?: boolean;
  serviceAreaOfCoverage?: string; // comma-separated cities; becomes schema areaServed
  // Primary booking action — every "book" CTA (header button, service pages'
  // closing block, CTA bands) reads these instead of hard-coding a route.
  bookingUrl?: string;
  bookingLabel?: string;
  businessDescription?: string; // one or two plain sentences for the schema Business node
  // Machine-readable hours for schema (hours above is display HTML), e.g.
  // [{ dayOfWeek: ["Monday","Tuesday"], opens: "08:00", closes: "18:00" }]
  openingHoursSpecification?: { dayOfWeek: string[]; opens: string; closes: string }[];
  hours?: string; // rich text/HTML — formatted hours table, not a plain string
  afterHours?: string; // rich text/HTML
  mapEmbedLink?: string;
  googleReviewsLink?: string;
  facebookReviewsLink?: string;
  yelpReviewLink?: string;
  googleRating?: number; // static fallback shown until googleWidgetId is configured
  googleReviewCount?: number;
  logoColor?: string; // asset path
  logoWhite?: string; // asset path
  footerAbout?: string; // ~160-char practice blurb, Footer's About Us column
  cityState?: string; // "[CITY, ST]" display string
  googleWidgetId?: string;
  // UserWay accessibility-widget account id. Optional override only — leave
  // unset to use the agency's own company-wide account (E6izlREqK3, baked
  // into AccessibilityWidget.astro as the default); set this only if a
  // specific client needs their own separate UserWay account.
  userwayAccountId?: string;
  url?: string; // site's canonical origin, e.g. "https://example.com" — the SINGLE
  // place the domain is configured. astro.config.mjs imports this file directly
  // and sets Astro's `site` from this field, so canonical URLs, OG/Twitter tags,
  // and the sitemap all derive from it automatically — never hard-code the
  // domain anywhere else. MUST be the real production domain (no trailing
  // slash) before launch, or canonical/sitemap URLs will point at the
  // placeholder below.
  // Schema.org @type for the site-wide Business node (see Skeleton-Build-Spec.md
  // §9/§14 item 8). Set it from intake — defaults to "VeterinaryCare", but a
  // non-clinic client (trainer, groomer, boarding) is NOT VeterinaryCare:
  // use e.g. ["LocalBusiness", "ProfessionalService"]. A mobile business
  // also sets mobileVet + serviceAreaOfCoverage (→ areaServed).
  businessSchemaType?: string | string[];
}

// Placeholder example data — replace during client intake. Kept non-empty
// so components/pages have something real to render while the skeleton is
// being built and reviewed.
export const siteInfo: SiteInfo = {
  practiceName: "[Practice Name]",
  phoneNumber: "(000) 000-0000",
  email: "hello@example.com",
  address: "123 Main St",
  addressLine2: "[City, ST 00000]",
  bookingUrl: "/appointment-request",
  bookingLabel: "Book Now",
  cityState: "[City, ST]",
  hours: "<p>Mon&ndash;Fri: 8am&ndash;6pm<br>Sat: 9am&ndash;1pm<br>Sun: Closed</p>",
  // Exactly 160 characters — replace during client intake with real copy.
  footerAbout:
    "[Practice Name] provides compassionate, high-quality veterinary care for dogs, cats, and other companion animals throughout [City, ST] and the surrounding area.",
  // Example values — replace during client intake. Kept non-empty (same
  // reasoning as the other placeholder fields above) so ReputationWidget's
  // "leave a public review" stage actually has links to render instead of
  // silently filtering all three out.
  googleReviewsLink: "https://g.page/r/example/review",
  facebookReviewsLink: "https://www.facebook.com/example/reviews",
  yelpReviewLink: "https://www.yelp.com/biz/example",
  googleRating: 4.8, // example value — matches the real V2 export's placeholder rating
  googleReviewCount: 120, // example value only, not sourced from anywhere real
  url: "https://example.com", // REPLACE with the real domain before launch — see the field comment above
  // Placeholder mark + wordmark (scripts/generate-logo-placeholders.mjs) —
  // proves Header's crossfade renders end-to-end. REPLACE both with the
  // client's real logo files before launch (same public/ paths, or update
  // these to point at new ones).
  logoWhite: "/logo-white.svg",
  logoColor: "/logo-color.svg",
};
