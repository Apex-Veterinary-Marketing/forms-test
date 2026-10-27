import { getCollection, getEntry } from "astro:content";

export async function getAllDoctors() {
  return getCollection("doctors");
}
export async function getDoctorBySlug(slug: string) {
  return getEntry("doctors", slug);
}
export async function getHomeDoctors() {
  const all = await getAllDoctors();
  return all.filter((d) => d.data.showOnHome);
}
