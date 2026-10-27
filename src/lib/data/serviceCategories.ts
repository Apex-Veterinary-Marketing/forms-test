import { getCollection, getEntry } from "astro:content";

export async function getAllServiceCategories() {
  return getCollection("serviceCategories");
}
export async function getServiceCategoryBySlug(slug: string) {
  return getEntry("serviceCategories", slug);
}
