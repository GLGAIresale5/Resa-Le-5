import type { Metadata } from "next";
import WebsiteLayout from "../components/WebsiteLayout";
import RestaurantContent from "../components/restaurant/RestaurantContent";

export const metadata: Metadata = {
  title: "Le Restaurant — Le 5 | Bar · Tapas · Brasserie",
  description:
    "Le 5 à Sucy-en-Brie : 70 couverts en salle, 52 places en terrasse sur la place du village. Bar à cocktails, brasserie maison, privatisation possible.",
  openGraph: {
    title: "Le Restaurant — Le 5",
    description: "Brasserie, bar à cocktails et terrasse sur la place du village de Sucy-en-Brie.",
    images: [{ url: "/images/place-village-large.webp", alt: "Terrasse du 5 sur la place du village" }],
  },
};

export default function LeRestaurantPage() {
  return (
    <WebsiteLayout>
      <RestaurantContent />
    </WebsiteLayout>
  );
}
