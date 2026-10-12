import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Badge } from "./badge";
import { Container } from "./container";

const FOOTER_LINKS = [
  { href: "/vision", label: "Vision" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
] as const;

/**
 * `new Date()` may not run in the prerendered shell (Cache Components);
 * caching it makes the value a stable build-time snapshot.
 */
async function CopyrightYear() {
  "use cache";
  return new Date().getFullYear();
}

export async function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <Container className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>
            © <CopyrightYear /> {siteConfig.companyName}
          </span>
          <span>
            from the house of{" "}
            <a
              href={siteConfig.parentCompanyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {siteConfig.parentCompanyName}
            </a>
          </span>
          <Badge>Private beta</Badge>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>
    </footer>
  );
}
