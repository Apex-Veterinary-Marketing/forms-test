import { getCollection, getEntry } from "astro:content";

export async function getAllServices() {
  return getCollection("services");
}
export async function getServiceBySlug(slug: string) {
  return getEntry("services", slug);
}
export async function getFeaturedServices() {
  const all = await getAllServices();
  return all.filter((s) => s.data.featured);
}
export async function getServicesByCategory(categorySlug: string) {
  const all = await getAllServices();
  return all.filter((s) => s.data.serviceCategory.some((ref) => ref.id === categorySlug));
}
