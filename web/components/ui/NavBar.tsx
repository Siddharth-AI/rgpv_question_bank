"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/insights", label: "Insights" },
];

export function NavBar() {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/60 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="block h-2.5 w-2.5 rounded-full bg-accent-gradient" />
          <span className="font-display text-xl tracking-tight">RGPV Exam Insights</span>
        </Link>
        <ul className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`rounded-2xl px-4 py-2 text-sm transition-all ${
                    active
                      ? "bg-surface/80 text-text shadow-glow border border-violet/40"
                      : "text-muted hover:text-text hover:bg-surface/40"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
