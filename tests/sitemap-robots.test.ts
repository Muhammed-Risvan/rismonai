import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { siteConfig } from "@/config/site";

describe("robots", () => {
  it("allows public crawling, blocks private routes, points at the sitemap", () => {
    const result = robots();

    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api"],
    });
    expect(result.sitemap).toBe(`${siteConfig.url}/sitemap.xml`);
  });
});

describe("sitemap", () => {
  it("lists public pages as absolute URLs", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain(siteConfig.url);
    expect(urls).toContain(`${siteConfig.url}/vision`);
    expect(urls).toContain(`${siteConfig.url}/privacy`);
    expect(urls).toContain(`${siteConfig.url}/terms`);
    expect(urls.length).toBeGreaterThanOrEqual(5);

    for (const url of urls) {
      expect(url.startsWith(`${siteConfig.url}/`) || url === siteConfig.url).toBe(
        true,
      );
    }
  });

  it("never lists private or non-public routes", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls.some((url) => url.includes("/dashboard"))).toBe(false);
    expect(urls.some((url) => url.includes("/login"))).toBe(false);
    expect(urls.some((url) => url.includes("/api"))).toBe(false);
  });
});
