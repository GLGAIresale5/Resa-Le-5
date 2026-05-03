import type { Metadata } from "next";
import WebsiteLayout from "./components/WebsiteLayout";
import HomeContent from "./components/home/HomeContent";

export const metadata: Metadata = {
  title: "Le 5 — Bar · Tapas · Brasserie | Sucy-en-Brie",
  description:
    "Le 5, brasserie parisienne au coeur de Sucy-en-Brie. Cuisine maison, cocktails signatures, terrasse sur la place du village. Ouvert 6 jours sur 7.",
  openGraph: {
    title: "Le 5 — Bar · Tapas · Brasserie",
    description: "Brasserie parisienne au coeur de Sucy-en-Brie. Cuisine maison, cocktails, terrasse sur la place du village.",
    images: [{ url: "/images/place-le5-soir.webp", width: 1440, height: 1920, alt: "La terrasse du 5 sur la place du village" }],
    locale: "fr_FR",
    type: "website",
    siteName: "Le 5",
  },
  twitter: {
    card: "summary_large_image",
    title: "Le 5 — Bar · Tapas · Brasserie",
    description: "Brasserie parisienne au coeur de Sucy-en-Brie.",
    images: ["/images/place-le5-soir.webp"],
  },
};

export default function HomePage() {
  return (
    <WebsiteLayout>
      <HomeContent />
    </WebsiteLayout>
  );
}
