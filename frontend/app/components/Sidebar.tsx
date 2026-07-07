"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useAuth } from "../lib/auth-context";

type NavItemDef =
  | { label: string; path: string; module: string; icon: React.ReactNode; soon?: boolean; children?: never }
  | { label: string; module: string; icon: React.ReactNode; path?: string; children: { label: string; path: string; module: string }[]; soon?: never };

const navItemDefs: NavItemDef[] = [
  {
    label: "Tableau de bord",
    path: "/dashboard",
    module: "dashboard",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
      </svg>
    ),
  },
  {
    label: "Réservations",
    path: "/reservations",
    module: "reservations",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: "Avis clients",
    path: "/avis",
    module: "avis",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  {
    label: "Réseaux sociaux",
    path: "/reseaux",
    module: "reseaux",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
      </svg>
    ),
  },
  {
    label: "Stocks",
    module: "stocks",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    children: [
      { label: "Bar", path: "/stocks", module: "stocks" },
      { label: "Cuisine", path: "/stocks-cuisine", module: "stocks-cuisine" },
    ],
  },
  {
    label: "Compta",
    path: "/compta",
    module: "compta",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6h7.5v2.25h-7.5V6zM8.25 11.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm2.748-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm2.754-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
      </svg>
    ),
    children: [
      { label: "Factures", path: "/factures", module: "factures" },
      { label: "Bilan", path: "/compta/bilan", module: "compta" },
      { label: "TVA", path: "/compta/tva", module: "compta" },
      { label: "Charges", path: "/compta/charges", module: "compta" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const slug = params.restaurant as string;
  const { restaurant } = useAuth();

  const modules = restaurant?.modules;

  // Filter by allowed modules, then prefix paths with restaurant slug
  const navItems = navItemDefs
    .filter((item) => {
      if (!modules) return true; // no restriction = show all
      if (item.children) {
        return item.children.some((c) => modules.includes(c.module));
      }
      return modules.includes(item.module);
    })
    .map((item) => {
      if (item.children) {
        const filteredChildren = modules
          ? item.children.filter((c) => modules.includes(c.module))
          : item.children;
        return {
          ...item,
          href: item.path ? `/${slug}${item.path}` : undefined,
          children: filteredChildren.map((c) => ({ ...c, href: `/${slug}${c.path}` })),
        };
      }
      return { ...item, href: `/${slug}${item.path}` };
    });

  return (
    <aside className="hidden md:flex h-screen flex-col border-r border-neutral-800 bg-neutral-950 w-16 lg:w-56 transition-all duration-200">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-neutral-800 px-3 lg:px-5 py-5 justify-center lg:justify-start">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
          <span className="text-xs font-bold text-neutral-950">G</span>
        </div>
        <div className="min-w-0 hidden lg:block">
          <p className="truncate text-sm font-semibold tracking-tight text-white">GLG AI</p>
          <p className="truncate text-xs text-neutral-500">{restaurant?.name ?? "Restaurant"}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-2 lg:p-3">
        {navItems.map((item) => {
          if (item.children) {
            const parentHref = item.href ?? item.children[0].href;
            const isGroupActive =
              (item.href ? pathname.startsWith(item.href) : false) ||
              item.children.some((c) => pathname.startsWith(c.href));
            return (
              <div key={item.label}>
                <Link
                  href={parentHref}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition justify-center lg:justify-start ${
                    isGroupActive
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-400 hover:bg-neutral-900/70 hover:text-white"
                  }`}
                  title={item.label}
                >
                  {item.icon}
                  <span className="font-medium hidden lg:inline">{item.label}</span>
                </Link>
                {isGroupActive && (
                  <>
                    <div className="hidden lg:flex ml-4 flex-col gap-0.5 border-l border-neutral-800 pl-3 mt-0.5">
                      {item.children.map((child) => {
                        const isActive = pathname === child.href || pathname.startsWith(child.href + "/");
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`rounded-lg px-3 py-2 text-sm transition ${
                              isActive
                                ? "bg-neutral-900 font-medium text-white"
                                : "text-neutral-400 hover:bg-neutral-900/70 hover:text-white"
                            }`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                    <div className="flex lg:hidden flex-col gap-0.5 mt-0.5">
                      {item.children.map((child) => {
                        const isActive = pathname === child.href || pathname.startsWith(child.href + "/");
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`flex items-center justify-center rounded-lg px-1 py-1.5 text-[10px] transition ${
                              isActive
                                ? "bg-neutral-900 font-medium text-white"
                                : "text-neutral-500 hover:bg-neutral-900/70 hover:text-white"
                            }`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          }

          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.soon ? "#" : item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition justify-center lg:justify-start ${
                isActive
                  ? "bg-neutral-900 text-white"
                  : item.soon
                  ? "cursor-default text-neutral-500"
                  : "text-neutral-400 hover:bg-neutral-900/70 hover:text-white"
              }`}
              title={item.label}
            >
              {item.icon}
              <span className="hidden lg:inline">{item.label}</span>
              {item.soon && (
                <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 hidden lg:inline">
                  Bientôt
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Settings — pinned at bottom */}
      <div className="mt-auto border-t border-neutral-800 p-2 lg:p-3">
        <Link
          href={`/${slug}/parametres`}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition justify-center lg:justify-start ${
            pathname.includes("/parametres")
              ? "bg-neutral-900 text-white"
              : "text-neutral-400 hover:bg-neutral-900/70 hover:text-white"
          }`}
          title="Paramètres"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden lg:inline">Paramètres</span>
        </Link>
      </div>
    </aside>
  );
}
