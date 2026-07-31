import type { Metadata } from "next";

// La page du jeu est atteinte par le QR de l'addition, jamais par la recherche.
// robots.ts autorise l'indexation par défaut → on la retire explicitement ici.
export const metadata: Metadata = {
  title: "La Chance du 5",
  description: "Tentez votre chance — 1 chance sur 3 de gagner.",
  robots: { index: false, follow: false },
};

export default function JeuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
