import { siteInfo } from "../../data/site";
import type { SiteInfo } from "../../data/site";

// Accessor kept consistent with every other data module in this folder —
// even though today this just returns a static import, a future swap to a
// remote source (e.g. a small CMS-editable JSON) only touches this file.
//
// Address privacy is enforced HERE, once: when the street address isn't
// public (showStreetAddress, see site.ts) the street, map link and map embed
// are removed before any component or schema node sees them.
export async function getSiteInfo(): Promise<SiteInfo> {
  const showStreet = siteInfo.showStreetAddress ?? !siteInfo.mobileVet;
  if (showStreet) return siteInfo;
  return { ...siteInfo, address: undefined, addressLink: undefined, mapEmbedLink: undefined };
}
