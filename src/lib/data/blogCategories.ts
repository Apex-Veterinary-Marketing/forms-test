import { getCollection, getEntry } from "astro:content";

export async function getAllBlogCategories() {
  return getCollection("blogCategories");
}
export async function getBlogCategoryBySlug(slug: string) {
  return getEntry("blogCategories", slug);
}
