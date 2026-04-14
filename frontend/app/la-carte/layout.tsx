import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "La Carte — Le 5 | Bar · Tapas · Brasserie",
  description: "Découvrez la carte du restaurant Le 5 à Sucy-en-Brie : tapas, brasserie, cocktails, vins et bières artisanales Deck & Donohue.",
};

export default function LaCarteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
