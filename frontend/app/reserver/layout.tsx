import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Réserver une table",
  description: "Réservez votre table en ligne.",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-stone-50">
      {children}
    </div>
  );
}
