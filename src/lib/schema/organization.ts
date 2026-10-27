// Site-wide JSON-LD (Skeleton-Build-Spec.md §9, §14 item 8). BaseLayout puts
// these nodes on every page, plus the page's own WebPage + BreadcrumbList,
// plus whatever the page passes in `schemaGraph`. Page nodes link to the
// site nodes by @id instead of repeating business details.
//
//   WebSite    #website   (with a SearchAction → /search)
//   Business   #business  (@type from site.businessSchemaType; address,
//                          areaServed, hours, sameAs, booking ReserveAction)
//
// @id conventions (normalizeIds() turns them into absolute URLs):
//   "#website" / "#business"   site entities → https://domain/#business
//   "#service", "#faq", ...    page-scoped   → https://domain/services/x#service
//   "/doctors/x#person"        another page's node → https://domain/doctors/x#person
// Page-scoped URLs drop the trailing slash so a reference from another page
// matches the node's own @id exactly (the homepage keeps its root slash).
import { getSiteInfo } from "../data/site";
import { getAllSocialLinks } from "../data/socialLinks";
import { BLOG_BASE } from "../data/blog";

/** @ids that name site-wide entities; every other "#name" is page-scoped. */
export const SITE_ENTITY_IDS = ["#website", "#business"];

const clean = (node: Record<string, any>) =>
  Object.fromEntries(Object.entries(node).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)));

export async function getSiteSchemaNodes(origin: URL): Promise<Record<string, any>[]> {
  const site = await getSiteInfo();
  const abs = (path: string) => new URL(path, origin).href;
  const socials = (await getAllSocialLinks()).map((s) => s.data.link);
  const reviewLinks = [site.googleReviewsLink, site.facebookReviewsLink, site.yelpReviewLink].filter((l): l is string => Boolean(l));
  const areas = (site.serviceAreaOfCoverage || "").split(",").map((s) => s.trim()).filter(Boolean);

  const website = {
    "@type": "WebSite",
    "@id": "#website",
    url: abs("/"),
    name: site.practiceName,
    publisher: { "@id": "#business" },
    inLanguage: "en-US",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${abs("/search")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  // getSiteInfo() has already removed the street when it isn't public, so a
  // hidden address never reaches schema; locality/region/ZIP still do.
  const address = clean({
    "@type": "PostalAddress",
    streetAddress: site.address,
    addressLocality: site.addressLocality,
    addressRegion: site.addressRegion,
    postalCode: site.postalCode,
    addressCountry: site.addressLocality ? "US" : undefined,
  });

  const business = clean({
    "@type": site.businessSchemaType || "VeterinaryCare",
    "@id": "#business",
    name: site.practiceName,
    description: site.businessDescription,
    url: abs("/"),
    logo: site.logoColor ? { "@type": "ImageObject", url: abs(site.logoColor) } : undefined,
    image: abs("/og-default.png"),
    telephone: site.phoneNumber,
    email: site.email,
    address: Object.keys(address).length > 1 ? address : undefined,
    hasMap: site.addressLink,
    areaServed: areas.map((name) => ({ "@type": "City", name })),
    openingHoursSpecification: (site.openingHoursSpecification || []).map((h) => ({ "@type": "OpeningHoursSpecification", ...h })),
    sameAs: [...new Set([...socials, ...reviewLinks])],
    potentialAction: site.bookingUrl
      ? {
          "@type": "ReserveAction",
          name: site.bookingLabel,
          target: { "@type": "EntryPoint", urlTemplate: abs(site.bookingUrl) },
        }
      : undefined,
  });

  return [website, business];
}

/** Breadcrumb names (and targets, for segments with no page of their own) per URL segment. */
const SEGMENTS: Record<string, { name: string; href?: string }> = {
  services: { name: "Services" },
  "services-categories": { name: "Services", href: "/services" },
  [BLOG_BASE.slice(1)]: { name: "Blog" },
  "blog-categories": { name: "Blog", href: BLOG_BASE },
  doctors: { name: "Meet the Team", href: "/meet-the-team" },
  staff: { name: "Meet the Team", href: "/meet-the-team" },
};

export function buildBreadcrumb(pathname: string, pageName: string, origin: URL) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return undefined;
  const items = [{ name: "Home", url: new URL("/", origin).href }];
  segments.forEach((seg, i) => {
    const last = i === segments.length - 1;
    const path = "/" + segments.slice(0, i + 1).join("/");
    const known = SEGMENTS[seg];
    items.push({
      name: last ? pageName : known?.name || seg,
      url: new URL(!last && known?.href ? known.href : path, origin).href,
    });
  });
  return {
    "@type": "BreadcrumbList",
    "@id": "#breadcrumb",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}

/** Rewrites short @ids (and {"@id": ...} references) to absolute URLs — see the header comment. */
export function normalizeIds<T>(value: T, origin: URL, pageUrl: string): T {
  const pageBase = new URL(pageUrl).pathname === "/" ? pageUrl : pageUrl.replace(/\/$/, "");
  const fix = (id: string) => {
    if (id.startsWith("/")) return new URL(id, origin).href;
    if (!id.startsWith("#")) return id;
    return SITE_ENTITY_IDS.includes(id) ? `${new URL("/", origin).href}${id}` : `${pageBase}${id}`;
  };
  const walk = (v: any): any => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "@id" && typeof x === "string" ? fix(x) : walk(x)]));
    }
    return v;
  };
  return walk(value);
}
