// Dynamic endpoint (not a static public/llms.txt) so it's generated from the
// same config singleton and content collections as the rest of the site,
// per Skeleton-Build-Spec.md §10 ("an llms.txt file at the site root,
// favoring structured Q&A-shaped content"). This is the structural half of
// that requirement — real per-client narrative copy (practice voice,
// differentiators) is still a content/authoring task at launch, not
// something this endpoint can generate; see Plan.md §8.
import type { APIRoute } from "astro";
import { getSiteInfo } from "../lib/data/site";
import { getAllServiceCategories } from "../lib/data/serviceCategories";
import { getAllServices } from "../lib/data/services";
import { stripHtml } from "../lib/utils/stripHtml";
import { BLOG_BASE } from "../lib/data/blog";

export const GET: APIRoute = async ({ site }) => {
  const base = site!;
  const url = (path: string) => new URL(path, base).href;

  const [siteInfo, categories, services] = await Promise.all([
    getSiteInfo(),
    getAllServiceCategories(),
    getAllServices(),
  ]);

  const lines: string[] = [];
  lines.push(`# ${siteInfo.practiceName}`);
  lines.push("");
  // businessDescription describes a non-clinic business correctly; the
  // generic line assumes a veterinary practice. getSiteInfo() has already
  // removed a non-public street address.
  const summary = siteInfo.businessDescription || `Veterinary practice${siteInfo.cityState ? ` in ${siteInfo.cityState}` : ""}.`;
  const location = siteInfo.address || siteInfo.addressLine2;
  lines.push(`> ${summary}${location ? ` ${location}` : ""}${siteInfo.phoneNumber ? ` · ${siteInfo.phoneNumber}` : ""}`);
  lines.push("");

  lines.push("## Pages");
  lines.push(`- [Home](${url("/")})`);
  lines.push(`- [Meet the Team](${url("/meet-the-team")})`);
  lines.push(`- [Services](${url("/services")})`);
  lines.push(`- [FAQ](${url("/faq")})`);
  lines.push(`- [Contact](${url("/contact-us")})`);
  lines.push(`- [Blog](${url(BLOG_BASE)})`);
  lines.push("");

  if (categories.length > 0) {
    lines.push("## Services");
    for (const category of categories) {
      const inCategory = services.filter((s) => s.data.serviceCategory.some((ref) => ref.id === category.id));
      if (inCategory.length === 0) continue;
      lines.push(`### ${category.data.name}`);
      for (const service of inCategory) {
        const name = service.data.customName || service.data.name;
        const summary = service.data.metaDescription || service.data.featuredText;
        lines.push(`- [${name}](${url(`/services/${service.id}`)})${summary ? `: ${stripHtml(summary)}` : ""}`);
      }
    }
    lines.push("");
  }

  const body = lines.join("\n").trimEnd() + "\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
