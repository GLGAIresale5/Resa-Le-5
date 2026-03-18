"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem =
  | { label: string; href: string; icon: React.ReactNode; soon?: boolean; children?: never }
  | { label: string; icon: React.ReactNode; children: { label: string; href: string }[]; href?: never; soon?: never };

const navItems: NavItem[] = [
  {
    label: "Réservations",
    href: "/reservations",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: "Avis clients",
    href: "/avis",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  {
    label: "Réseaux sociaux",
    href: "/reseaux",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
      </svg>
    ),
  },
  {
    label: "Stocks",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    children: [
      { label: "Bar", href: "/stocks" },
      { label: "Cuisine", href: "/stocks-cuisine" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-zinc-200 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
          <span className="text-xs font-bold text-white">G</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900">GLG AI</p>
          <p className="truncate text-xs text-zinc-400">Le 5</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-3">
        {navItems.map((item) => {
          if (item.children) {
            const isGroupActive = item.children.some((c) => pathname.startsWith(c.href));
            return (
              <div key={item.label}>
                {/* Group label */}
                <div className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm ${
                  isGroupActive ? "text-zinc-900" : "text-zinc-600"
                }`}>
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </div>
                {/* Sub-items */}
                <div className="ml-4 flex flex-col gap-0.5 border-l border-zinc-100 pl-3">
                  {item.children.map((child) => {
                    const isActive = pathname === child.href || pathname.startsWith(child.href + "/");
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`rounded-lg px-3 py-2 text-sm transition ${
                          isActive
                            ? "bg-zinc-900 font-medium text-white"
                            : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                        }`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.soon ? "#" : item.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
                isActive
                  ? "bg-zinc-900 text-white"
                  : item.soon
                  ? "cursor-default text-zinc-300"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <span className="flex items-center gap-2.5">
                {item.icon}
                {item.label}
              </span>
              {item.soon && (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                  Bientôt
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-zinc-100 px-5 py-4">
        <p className="text-xs text-zinc-400">GLG AI — v0.1</p>
      </div>
    </aside>
  );
}
