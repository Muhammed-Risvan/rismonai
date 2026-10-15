/**
 * Public site configuration.
 *
 * The registered jurisdiction is deliberately NOT configured here: it is not
 * yet confirmed, and inventing a value would put a false legal statement on
 * the public site. It will be added once confirmed.
 * `url` is the documented deployment host (README.md, docs/architecture.md).
 */
export const siteConfig = {
  name: "Rismon",
  tagline: "A tutor that remembers what you can actually do.",
  description:
    "Rismon turns your goal into a learning path, tests what you can prove, and decides what to learn next. Rismon is in private beta.",
  url: "https://rismon.ai",
  contactEmail: "hello@rismon.ai",
  companyName: "Rismon.ai",
  parentCompanyName: "Labs3am.com",
  parentCompanyUrl: "https://labs3am.com",
} as const;

/**
 * A `mailto:` link for the contact email, or `null` while the address is
 * still a placeholder — so pages never render a broken `mailto:` link.
 */
export function contactHref(): string | null {
  return siteConfig.contactEmail.includes("@")
    ? `mailto:${siteConfig.contactEmail}`
    : null;
}
