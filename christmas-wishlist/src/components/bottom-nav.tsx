"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/lists",
    label: "My lists",
    icon: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  },
  {
    href: "/shared",
    label: "Shared",
    icon: (
      <path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 20v-2a4 4 0 0 0-3-3.87M16 2.13a4 4 0 0 1 0 7.75" />
    ),
  },
  {
    href: "/shopping",
    label: "Shopping",
    icon: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
  },
  {
    href: "/account",
    label: "Account",
    icon: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
  },
];

/** Active tab follows the URL. Wrap in <Suspense> with <NavBar /> as fallback. */
export function BottomNav() {
  return <NavBar pathname={usePathname()} />;
}

/** The tab bar itself. Without a pathname (the static shell), no tab is highlighted. */
export function NavBar({ pathname }: { pathname?: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {TABS.map((tab) => {
          const active = pathname !== undefined && (pathname === tab.href || pathname.startsWith(`${tab.href}/`));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-sm font-semibold ${
                  active ? "text-pine" : "text-muted"
                }`}
              >
                <svg
                  aria-hidden
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2.4 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {tab.icon}
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
