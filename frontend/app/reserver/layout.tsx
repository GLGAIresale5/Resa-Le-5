import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Réserver une table — Le 5",
  description:
    "Réservez votre table au restaurant Le 5, 5 rue du Général Clergerie, Paris 16e.",
  openGraph: {
    title: "Réserver une table — Le 5",
    description: "Restaurant Le 5 — cuisine bistronomique, Paris 16e",
    type: "website",
  },
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
