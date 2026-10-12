"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ButtonLink } from "./button";
import { Container } from "./container";

const NAV_ITEMS = [
  { href: "/vision", label: "Vision" },
  { href: "/login", label: "Sign in" },
] as const;

/**
 * Site header: text logo, nav, "Request access" button and a mobile menu
 * built with plain React state — no extra libraries. The menu closes on
 * route change (via `key`) and on Escape; focus returns to the toggle
 * because the toggle button itself never unmounts.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function onMenuKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") setOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <Container className="flex h-14 items-center justify-between gap-4">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight"
          aria-label="Rismon home"
        >
          Rismon
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <ButtonLink href="/beta" size="sm">
            Request access
          </ButtonLink>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium md:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </Container>

      {open && (
        <div
          id="mobile-nav"
          className="border-t border-border md:hidden"
          onKeyDown={onMenuKeyDown}
        >
          <Container className="flex flex-col gap-1 py-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === item.href ? "page" : undefined}
                className="rounded-md px-2 py-2 text-sm text-muted hover:bg-surface hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <ButtonLink
              href="/beta"
              size="sm"
              className="mt-2 self-start"
              onClick={() => setOpen(false)}
            >
              Request access
            </ButtonLink>
          </Container>
        </div>
      )}
    </header>
  );
}
