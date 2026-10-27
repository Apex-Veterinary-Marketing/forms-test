// Phone links. Every call link dials the call-tracking
// number (site.callTrackingNumber) so calls from the website are attributed;
// the number SHOWN to visitors is always site.phoneNumber (the business line).
// Use phoneHref() for every href="tel:…" and site.phoneNumber for the text.
import type { SiteInfo } from "../../data/site";

export const toTelHref = (num?: string) => (num ? `tel:${num.replace(/[^\d+]/g, "")}` : undefined);

/** tel: link for any "call us" link or button: the tracking number when set. */
export function phoneHref(site: Pick<SiteInfo, "phoneNumber" | "callTrackingNumber">) {
  return toTelHref(site.callTrackingNumber || site.phoneNumber);
}

/** Rewrites every tel: link inside rich-text content to the tracking number. */
export function withTrackingPhone(html: string, site: Pick<SiteInfo, "phoneNumber" | "callTrackingNumber">) {
  const href = phoneHref(site);
  return href ? html.replace(/href="tel:[^"]*"/g, `href="${href}"`) : html;
}
