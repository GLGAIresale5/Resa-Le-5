"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

const TABS = [
  { label: "Aperçu", seg: "" },
  { label: "Bilan", seg: "bilan" },
  { label: "TVA", seg: "tva" },
  { label: "Charges", seg: "charges" },
];

export default function ComptaNav() {
  const pathname = usePathname();
  const params = useParams();
  const slug = params.restaurant as string;
  const base = `/${slug}/compta`;

  return (
    <div className="flex gap-1 rounded-full bg-neutral-900 p-1">
      {TABS.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname.startsWith(href) : pathname === base || pathname === base + "/";
        return (
          <Link
            key={t.label}
            href={href}
            className={`flex-1 rounded-full px-3 py-2 text-center text-sm font-medium transition ${
              active ? "bg-white text-neutral-950" : "text-neutral-400 hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
