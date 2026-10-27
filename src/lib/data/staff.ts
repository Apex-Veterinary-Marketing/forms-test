import { getCollection, getEntry } from "astro:content";

export async function getAllStaff() {
  return getCollection("staff");
}
export async function getStaffBySlug(slug: string) {
  return getEntry("staff", slug);
}
