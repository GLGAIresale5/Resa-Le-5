import type { Metadata } from "next";
import WebsiteLayout from "../components/WebsiteLayout";
import ContactContent from "../components/contact/ContactContent";

export const metadata: Metadata = {
  title: "Contact — Le 5 | Sucy-en-Brie",
  description:
    "Le 5 — 4 place du village, 94370 Sucy-en-Brie. Téléphone, horaires, accès, plan, et formulaire de contact. Bar · Tapas · Brasserie.",
  openGraph: {
    title: "Contact — Le 5",
    description: "4 place du village, 94370 Sucy-en-Brie. 09 83 94 46 00.",
    images: [{ url: "/images/place-village-large.webp" }],
  },
};

export default function ContactPage() {
  return (
    <WebsiteLayout>
      <ContactContent />
    </WebsiteLayout>
  );
}
