"use client";

import { useEffect, useState, useRef } from "react";
import WebsiteLayout from "../components/WebsiteLayout";

/* ---------- DATA ---------- */

type Item = { name: string; desc?: string; price: string; bold?: boolean };
type Category = { title: string; subtitle?: string; priceHeader?: string; items: Item[] };
type Section = { id: string; label: string; categories: Category[] };

const sections: Section[] = [
  {
    id: "petit-dejeuner",
    label: "Petit-Déjeuner",
    categories: [
      {
        title: "Petit-Déjeuner",
        items: [
          { name: "Continental", desc: "Boisson chaude, jus d'orange, tartine beurre & confiture, viennoiserie", price: "8,50€" },
          { name: "Complet", desc: "Continental + oeufs au choix (supplément jambon ou fromage +1,50€)", price: "11,50€" },
        ],
      },
    ],
  },
  {
    id: "boissons",
    label: "Côté Bar",
    categories: [
      {
        title: "Boissons Chaudes",
        items: [
          { name: "Espresso", price: "2,20€" },
          { name: "Espresso Double", price: "3,40€" },
          { name: "Allongé", price: "2,50€" },
          { name: "Noisette", price: "2,70€" },
          { name: "Crème", price: "3,80€" },
          { name: "Cappuccino", price: "4,50€" },
          { name: "Latte Macchiato", price: "5,00€" },
          { name: "Chocolat Chaud", price: "4,50€" },
          { name: "Thé & Infusion", price: "3,80€" },
          { name: "Irish Coffee", price: "9,00€" },
          { name: "Café Liqueur", desc: "Amaretto, Baileys, Get 27, Calva", price: "10,00€" },
        ],
      },
      {
        title: "Softs",
        items: [
          { name: "Sirop à l'eau", price: "3,00€" },
          { name: "Citronnade / Orangeade", price: "4,50€" },
          { name: "Diabolo", price: "4,80€" },
          { name: "Coca-Cola / Coca Zéro / Orangina / Perrier", price: "4,00€" },
          { name: "Schweppes Tonic / Agrum'", price: "4,00€" },
          { name: "Jus de fruits frais", desc: "Orange, Pomme, Ananas, Pamplemousse, Tomate, Abricot", price: "4,50€" },
          { name: "Red Bull", price: "6,20€" },
        ],
      },
      {
        title: "Eaux",
        items: [
          { name: "Évian (50cl / 1L)", price: "5,00€ / 7,00€" },
          { name: "Badoit (50cl / 1L)", price: "5,00€ / 7,00€" },
        ],
      },
      {
        title: "Apéritif",
        items: [
          { name: "Kir", desc: "Cassis, Mûre, Pêche", price: "5,50€" },
          { name: "Martini", desc: "Blanc, Rouge, Rosé", price: "5,50€" },
          { name: "Negroni", price: "8,00€" },
          { name: "Kir Royal", price: "9,00€" },
          { name: "Champagne Coupe", price: "6,00€" },
        ],
      },
      {
        title: "Bières Bouteille",
        items: [
          { name: "Heineken (25cl)", price: "4,50€" },
          { name: "Desperados (33cl)", price: "6,00€" },
          { name: "Corona (33cl)", price: "6,00€" },
          { name: "Grimbergen Blonde (33cl)", price: "5,50€" },
          { name: "1664 Blanc (33cl)", price: "5,50€" },
          { name: "Leffe Blonde (33cl)", price: "5,50€" },
          { name: "Budweiser (33cl)", price: "5,00€" },
          { name: "Heineken 0.0 (33cl)", price: "4,50€" },
        ],
      },
      {
        title: "Bières Pression",
        subtitle: "Brasserie Deck & Donohue",
        priceHeader: "25cl · 50cl",
        items: [
          { name: "Velvet Smash — IPA", price: "5,00€ · 8,50€" },
          { name: "Métro — Lager", price: "4,50€ · 7,50€" },
          { name: "Platine — Blanche", price: "4,50€ · 7,50€" },
          { name: "Cidre Pression", price: "4,50€ · 7,50€" },
        ],
      },
    ],
  },
  {
    id: "vins",
    label: "Vins",
    categories: [
      {
        title: "Vins Blancs",
        priceHeader: "Verre · Bouteille",
        items: [
          { name: "Viognier — Pays d'Oc", price: "5,00€ · 22,00€" },
          { name: "Chardonnay — Bourgogne", price: "6,00€ · 28,00€" },
          { name: "Colombelle — Côtes de Gascogne", price: "5,00€ · 22,00€" },
          { name: "Sancerre", price: "8,00€ · 38,00€" },
          { name: "Chablis", price: "9,00€ · 45,00€" },
        ],
      },
      {
        title: "Vins Rosés",
        priceHeader: "Verre · Bouteille",
        items: [
          { name: "Gris de Gris — Sable de Camargue", price: "5,00€ · 22,00€" },
          { name: "Cavalier 360 — Côtes de Provence", price: "7,50€ · 35,00€" },
        ],
      },
      {
        title: "Vins Rouges",
        priceHeader: "Verre · Bouteille",
        items: [
          { name: "Merlot — Pays d'Oc", price: "5,00€ · 22,00€" },
          { name: "Pinot Noir — Bourgogne", price: "5,50€ · 25,00€" },
          { name: "Côtes du Rhône", price: "6,00€ · 28,00€" },
          { name: "Saint-Émilion Grand Cru", price: "9,00€ · 49,00€" },
        ],
      },
      {
        title: "Champagnes",
        priceHeader: "Coupe · Bouteille",
        items: [
          { name: "EPC — Champagne Maison", price: "12,00€ · 50,00€" },
          { name: "EPC Rosé", price: "14,00€ · 80,00€" },
          { name: "François Dauderet", price: "9,00€", desc: "Coupe" },
          { name: "Ruinart", price: "95,00€", desc: "Bouteille" },
        ],
      },
    ],
  },
  {
    id: "cocktails",
    label: "Cocktails",
    categories: [
      {
        title: "Cocktails Classiques",
        priceHeader: "Simple · Double",
        items: [
          { name: "Spritz", price: "9,00€ · 16,00€" },
          { name: "Pina Colada", price: "10,00€ · 17,00€" },
          { name: "Cuba Libre", price: "9,00€ · 16,00€" },
          { name: "Mojito", price: "10,00€ · 17,00€" },
          { name: "Cosmopolitan", price: "10,00€ · 17,00€" },
          { name: "Long Island", price: "12,00€ · 20,00€" },
          { name: "Gin Tonic", price: "9,00€ · 16,00€" },
          { name: "Moscow Mule", price: "10,00€ · 17,00€" },
          { name: "Margarita", price: "10,00€ · 17,00€" },
          { name: "Daiquiri", price: "10,00€ · 17,00€" },
          { name: "Caipirinha", price: "10,00€ · 17,00€" },
          { name: "Ti Punch", price: "9,00€ · 16,00€" },
        ],
      },
      {
        title: "Cocktails Signatures",
        priceHeader: "Simple · Double",
        items: [
          { name: "Le 5", desc: "Notre cocktail signature", price: "10,00€ · 18,00€", bold: true },
          { name: "Patron Paloma", price: "12,00€ · 20,00€" },
          { name: "French Pornstar", price: "12,00€ · 20,00€" },
          { name: "Spicy Margarita", price: "11,00€ · 19,00€" },
        ],
      },
      {
        title: "Cocktails Sans Alcool",
        items: [
          { name: "Virgin 5", price: "8,00€" },
          { name: "Iced Tea Maison", desc: "Pêche, Mangue, Fruits rouges", price: "6,00€" },
          { name: "Virgin Mojito", price: "8,00€" },
          { name: "Virgin Pina", price: "8,00€" },
        ],
      },
      {
        title: "Shooters",
        priceHeader: "Shot · ½ mètre · Mètre",
        items: [
          { name: "Classiques", desc: "B52, Kamikaze, Tequila Paf...", price: "4,00€ · 15,00€ · 28,00€" },
          { name: "Premium", desc: "Jägermeister, Jack Daniel's...", price: "5,50€ · 20,00€ · 35,00€" },
        ],
      },
      {
        title: "Spiritueux",
        subtitle: "4cl",
        items: [
          { name: "Baileys / Get 27 / Get 31 / Limoncello", price: "7,00€ – 9,00€" },
          { name: "Vodka / Gin", price: "6,50€ – 9,00€" },
          { name: "Rhum", price: "7,00€ – 12,00€" },
          { name: "Whisky", price: "7,00€ – 13,00€" },
          { name: "Tequila / Mezcal", price: "7,00€ – 11,00€" },
        ],
      },
    ],
  },
  {
    id: "tapas",
    label: "Tapas",
    categories: [
      {
        title: "Tapas — À Partager",
        items: [
          { name: "Rillettes de Thon", price: "5,00€" },
          { name: "Rillettes du 5", price: "11,00€" },
          { name: "Saucisse Sèche", price: "11,00€" },
          { name: "Toast Tomate × Saumon", price: "9,00€" },
          { name: "Pain à l'Ail", price: "6,00€" },
          { name: "Sticks de Mozzarella", price: "6,00€" },
          { name: "Camembert Rôti au Miel et Lard", price: "14,00€" },
          { name: "Sélection de Fromages", price: "15,00€" },
          { name: "Sélection de Charcuterie", price: "15,00€" },
          { name: "Sélection Mixte", price: "25,00€" },
          { name: "La Planche du 5", desc: "Rillettes, pâté, sticks mozza, tenders, sélection mixte", price: "55,00€", bold: true },
        ],
      },
    ],
  },
  {
    id: "brasserie",
    label: "Brasserie",
    categories: [
      {
        title: "Entrées",
        items: [
          { name: "Oeufs Mayonnaise", price: "6,00€" },
          { name: "Harengs Pomme à l'Huile", price: "7,00€" },
          { name: "Terrine du 5", price: "9,00€" },
        ],
      },
      {
        title: "Salades",
        items: [
          { name: "Caesar", desc: "Poulet, parmesan, croûtons, sauce caesar", price: "14,00€" },
          { name: "du Berger", desc: "Chèvre chaud, miel, noix, lardons", price: "16,00€" },
          { name: "Landaise", desc: "Gésiers, foie gras, magret fumé", price: "18,00€" },
        ],
      },
      {
        title: "Woks",
        items: [
          { name: "Wok Végan", price: "14,00€" },
          { name: "Wok Poulet", price: "15,00€" },
          { name: "Wok Crevette", price: "16,00€" },
        ],
      },
      {
        title: "Plats",
        items: [
          { name: "Croque-Monsieur", price: "12,00€" },
          { name: "Croque-Madame", price: "13,50€" },
          { name: "Croque-Truffe", price: "14,00€" },
          { name: "Tartare de Boeuf à la Française", price: "17,50€" },
          { name: "Burger de Boeuf", price: "17,00€" },
          { name: "Andouillette AAAAA", price: "18,00€" },
          { name: "Pièce du Boucher", price: "23,00€", bold: true },
        ],
      },
      {
        title: "Garnitures",
        items: [
          { name: "Frites / Salade / Poêlée de Légumes / Riz", price: "4,00€" },
        ],
      },
      {
        title: "Menu Enfant",
        subtitle: "12,50€",
        items: [
          { name: "Jus de fruit ou sirop + Tenders, Sticks mozza ou Burger + Glace au choix", price: "12,50€" },
        ],
      },
    ],
  },
  {
    id: "desserts",
    label: "Desserts",
    categories: [
      {
        title: "Desserts",
        items: [
          { name: "Assiette de Fromages", price: "8,00€" },
          { name: "Crème Brûlée", price: "7,00€" },
          { name: "Tiramisu du Moment", price: "7,00€" },
          { name: "Île Flottante", price: "8,00€" },
          { name: "Tarte Tatin", desc: "Glace vanille & coulis caramel", price: "10,50€" },
          { name: "Moelleux au Chocolat", desc: "Glace vanille & chantilly", price: "11,00€" },
          { name: "Pavlova du Moment", price: "9,00€" },
          { name: "Café Gourmand", price: "11,00€", bold: true },
        ],
      },
      {
        title: "Glaces & Crêpes",
        items: [
          { name: "1 Boule / 2 Boules / 3 Boules", desc: "Vanille, Chocolat, Fraise, Pistache, Café, Caramel, Citron, Framboise, Coco", price: "3,00€ / 6,00€ / 8,00€" },
          { name: "Crêpe Nature / Sucre", price: "3,50€" },
          { name: "Crêpe Nutella / Chocolat / Spéculoos / Caramel", price: "4,50€" },
        ],
      },
    ],
  },
];

/* ---------- COMPONENT ---------- */

export default function LaCartePage() {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Intersection Observer to track which section is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry with the largest intersection ratio
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0 && visible[0].target.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <WebsiteLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="px-6 py-16 md:px-12 text-center">
          <h1 className="font-serif text-4xl md:text-5xl text-[#e8e0d4] mb-3">La Carte</h1>
          <p className="text-[#8a8072] text-sm tracking-[0.2em] uppercase">Carte 2026</p>
        </div>

        {/* Tab navigation */}
        <nav className="sticky top-16 lg:top-0 z-30 bg-[#111111]/95 backdrop-blur-md border-b border-[#1a1a1a]">
          <div className="flex overflow-x-auto no-scrollbar px-6 md:px-12 justify-center">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`shrink-0 px-5 py-4 text-sm tracking-wide transition-colors border-b-2 ${
                  activeSection === s.id
                    ? "text-[#c9a96e] border-[#c9a96e]"
                    : "text-[#8a8072] border-transparent hover:text-[#c9a96e] hover:border-[#c9a96e]/30"
                }`}
              >
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Menu content — centered */}
        <div className="px-6 md:px-12 py-12 max-w-3xl mx-auto">
          {sections.map((section) => (
            <div
              key={section.id}
              id={section.id}
              className="mb-16 scroll-mt-32 lg:scroll-mt-16"
              ref={(el) => {
                if (el) sectionRefs.current.set(section.id, el);
              }}
            >
              <h2 className="font-serif text-3xl text-[#c9a96e] mb-8">{section.label}</h2>
              {section.categories.map((cat, ci) => (
                <div key={ci} className="mb-10">
                  {/* Category header */}
                  <div className="mb-4">
                    <div className="flex justify-between items-baseline">
                      <div>
                        <h3 className="text-lg text-[#e8e0d4] font-medium tracking-wide">{cat.title}</h3>
                        {cat.subtitle && (
                          <p className="text-xs text-[#5a5550] mt-1">{cat.subtitle}</p>
                        )}
                      </div>
                      {cat.priceHeader && (
                        <span className="text-xs text-[#8a8072] italic tracking-wide shrink-0 ml-4">
                          {cat.priceHeader}
                        </span>
                      )}
                    </div>
                    {/* Separator line under header */}
                    <div className="mt-3 border-b border-[#2a2a2a]" />
                  </div>

                  {/* Items */}
                  <div className="space-y-0">
                    {cat.items.map((item, ii) => (
                      <div
                        key={ii}
                        className={`flex justify-between gap-4 py-3 border-b border-[#1a1a1a] ${
                          item.bold ? "bg-[#c9a96e]/5 -mx-3 px-3 rounded" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`${item.bold ? "text-[#c9a96e] font-medium" : "text-[#e8e0d4]"}`}>
                            {item.name}
                          </p>
                          {item.desc && !cat.priceHeader && (
                            <p className="text-[#6a6560] text-sm mt-0.5">{item.desc}</p>
                          )}
                          {item.desc && cat.priceHeader && (
                            <p className="text-[#6a6560] text-sm mt-0.5">{item.desc}</p>
                          )}
                        </div>
                        <span className="text-[#c9a96e] text-sm whitespace-nowrap shrink-0 pt-0.5">
                          {item.price}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="px-6 md:px-12 pb-16 max-w-3xl mx-auto">
          <p className="text-[#5a5550] text-xs text-center">
            Prix nets en euros, taxes et service compris. L&apos;abus d&apos;alcool est dangereux pour la santé.
          </p>
        </div>
      </div>
    </WebsiteLayout>
  );
}
