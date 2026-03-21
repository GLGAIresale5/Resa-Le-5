import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Réserver une table",
  description: "Réservez votre table au restaurant Le 5, bar tapas brasserie à Sucy-en-Brie.",
};

export default function ReserverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
