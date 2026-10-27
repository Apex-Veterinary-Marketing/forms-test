import { getCollection } from "astro:content";

export async function getAllSocialLinks() {
  return getCollection("socialLinks");
}
