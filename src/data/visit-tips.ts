// Shared "before your visit" prep tips — used on the homepage and the
// Appointment Request page (BeforeYourVisit.astro). One place to edit per
// client instead of two duplicate arrays. Icons are "icon-*" classes from
// src/styles/icon-font.css — see that component's own header comment for
// which two are approximate substitutes (no literal "document"/"heart"
// glyph in the font).
export interface VisitTip {
  icon: string;
  title: string;
  body: string;
  linkText?: string;
  linkHref?: string;
}

export const visitTips: VisitTip[] = [
  {
    icon: "icon-check-outline",
    title: "Fill out digital forms first",
    body: "Complete your new patient paperwork online so we can skip it at check-in.",
    linkText: "Forms",
    linkHref: "/online-forms",
  },
  {
    icon: "icon-hours",
    title: "Arrive 10 minutes early",
    body: "Arriving early gives your pet a minute to settle in before we call you back.",
  },
  {
    icon: "icon-calendar2",
    title: "Bring past records",
    body: "Transferring from another vet? Prior records help us pick up right where you left off.",
  },
  {
    icon: "icon-paw",
    title: "Leash dogs, crate cats",
    body: "Keeps everyone in the lobby comfortable, your pet included.",
  },
];
