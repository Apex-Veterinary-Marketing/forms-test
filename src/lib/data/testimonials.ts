import { getCollection } from "astro:content";

export async function getAllTestimonials() {
  return getCollection("testimonials");
}
