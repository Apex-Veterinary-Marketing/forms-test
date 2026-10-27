// Rich-text fields (bio, bioShort, faqs.answer, etc. — see content.config.ts)
// store HTML. Anywhere that HTML needs to feed a plain-text context — a
// <meta name="description">, an og:description, or a JSON-LD "description"
// string — needs it stripped first, or the tags leak straight into the
// output. Deliberately simple (regex, not a real HTML parser): good enough
// for the short, tag-light strings these fields hold in practice.
// Inline tags (links, bold, citations…) are removed without adding a space, so
// "(<a>Mills, 2020</a>)" becomes "(Mills, 2020)", not "( Mills, 2020 )"; block
// tags (p, li, br, headings) become a space so sentences don't run together.
const INLINE = /<\/?(a|strong|em|b|i|u|span|sup|sub|small|code|abbr|mark)\b[^>]*>/gi;
export function stripHtml(html: string): string {
  return html
    .replace(INLINE, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim();
}
