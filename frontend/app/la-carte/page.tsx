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
          { name: "Continental", desc: "Boisson chaude (Expresso, Allongé, Crème, Chocolat), Jus d'orange, Tartine, Viennoiserie (Croissant, Pain au Chocolat)", price: "8,50€" },
          { name: "Complet", desc: "Continental + Œufs au plat ou Omelette nature · +Jambon ou Fromage +1,50€ · Jambon et Fromage +2,50€", price: "11,50€" },
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
          { name: "Expresso", price: "2,20€" },
          { name: "Déca", price: "2,40€" },
          { name: "Allongé", price: "2,30€" },
          { name: "Double", price: "4,00€" },
          { name: "Noisette", price: "2,50€" },
          { name: "Petit Crème", price: "3,20€" },
          { name: "Crème", price: "3,50€" },
          { name: "Cappuccino", price: "6,00€" },
          { name: "Chocolat", price: "5,00€" },
          { name: "Thé", price: "4,50€" },
          { name: "Irish Coffee", price: "9,00€" },
          { name: "Liquor Coffee", desc: "French, Jamaican, Moscow, Mexican", price: "10,00€" },
        ],
      },
      {
        title: "Softs",
        items: [
          { name: "Sirop à l'eau 25cl", desc: "Grenadine, Fraise, Menthe, Pêche, Citron, Passion, Cassis, Caramel, Vanille, Rose, Curaçao, Violette, Rhum, Gingembre, Basilic, Spicy, Agave", price: "3,00€" },
          { name: "Limonade", price: "3,80€" },
          { name: "Diabolo", price: "4,20€" },
          { name: "Perrier 33cl", price: "4,60€" },
          { name: "Jus de fruit 25cl", desc: "Orange, Pomme, Ananas, Cranberry, Citron vert, Maracuja", price: "4,60€" },
          { name: "Coca Cola, Zéro, Cherry 33cl", price: "4,60€" },
          { name: "Orangina 25cl", price: "4,60€" },
          { name: "Schweppes Tonic, Agrumes, Ginger 33cl", price: "4,60€" },
          { name: "Orange pressée 20cl", price: "6,20€" },
          { name: "Red Bull 25cl", price: "5,60€" },
        ],
      },
      {
        title: "Eaux",
        items: [
          { name: "Minérale (50cl / 1L)", price: "5,00€ / 7,00€" },
          { name: "Pétillante (50cl / 1L)", price: "5,00€ / 7,00€" },
        ],
      },
      {
        title: "Apéritif",
        items: [
          { name: "Kir 12cl", desc: "Cassis, Mûre, Pêche, Framboise", price: "5,50€" },
          { name: "Cidre brut Appie 33cl", price: "6,00€" },
          { name: "Kir Royal 12cl", price: "9,00€" },
          { name: "Martini 6cl", desc: "Blanc, Rouge", price: "5,50€" },
          { name: "Noilly Prat Dry 6cl", price: "6,50€" },
          { name: "Americano 12cl", price: "8,00€" },
          { name: "Negroni 12cl", price: "8,00€" },
          { name: "Ricard 4cl", price: "5,00€" },
          { name: "Porto 6cl", price: "5,00€" },
          { name: "Lillet 6cl", desc: "Blanc, Rosé", price: "6,00€" },
          { name: "Coupe de Prosecco 12cl", price: "6,00€" },
          { name: "Coupe de Champagne 12cl", price: "9,00€" },
        ],
      },
      {
        title: "Bières Bouteilles",
        items: [
          { name: "Super Bock 25cl", price: "4,50€" },
          { name: "Corona 33cl", price: "6,50€" },
          { name: "Grimbergen 33cl", price: "6,50€" },
          { name: "Delirium Red 33cl", price: "6,50€" },
          { name: "BapBap sans alcool", price: "7,20€" },
        ],
      },
      {
        title: "Bières Pression",
        subtitle: "Deck & Donohue — Bières brassées à Bonneuil-sur-Marne",
        priceHeader: "25cl · 50cl",
        items: [
          { name: "D Pilsner", desc: "Blonde Pilsner bio, céréalière — 5%", price: "4,50€ · 8,00€" },
          { name: "Mission Pale", desc: "Pale Ale bio, agrumes & malt caramélisé — 4,8%", price: "5,00€ · 9,00€" },
          { name: "IPA", desc: "IPA bio, puissante & aromatique — 6,5%", price: "5,50€ · 9,50€" },
          { name: "Bière du Moment", desc: "Sélection tournante", price: "5,50€ · 9,50€" },
          { name: "Monaco / Panaché", price: "4,50€ · 8,00€" },
          { name: "Picon", price: "6,00€ · 10,50€" },
        ],
      },
      {
        title: "Vodka & Gin",
        subtitle: "4cl",
        items: [
          { name: "42 Below", price: "6,50€" },
          { name: "Grey Goose", price: "9,50€" },
          { name: "Bombay Sapphire", price: "8,00€" },
          { name: "Bombay Gingembre", price: "8,00€" },
        ],
      },
      {
        title: "Rhum",
        subtitle: "4cl",
        items: [
          { name: "Bacardi Carta Oro", price: "7,00€" },
          { name: "Don Papa Masskara", price: "9,50€" },
          { name: "Diplomatico", price: "9,00€" },
          { name: "Santa Teresa", price: "12,00€" },
        ],
      },
      {
        title: "Whisky",
        subtitle: "4cl",
        items: [
          { name: "William Lawson", price: "6,00€" },
          { name: "Jameson", price: "7,00€" },
          { name: "Jack Daniels", price: "8,00€" },
          { name: "Glenmorangie", price: "10,00€" },
          { name: "Lagavulin 16 ans", price: "13,00€" },
        ],
      },
      {
        title: "Tequila",
        subtitle: "4cl",
        items: [
          { name: "Cazadores Reposado", price: "8,00€" },
          { name: "Patron Silver / Reposado / Anejo", price: "10€ / 11€ / 11,50€" },
        ],
      },
      {
        title: "Liqueurs 6cl",
        items: [
          { name: "Bailey's", price: "7€" },
          { name: "Get 27 ou 31", price: "7€" },
          { name: "Manzana", price: "7€" },
          { name: "Limoncello", price: "8€" },
          { name: "Belle Gnôle Sapin", price: "9€" },
        ],
      },
      {
        title: "Digestifs 4cl",
        items: [
          { name: "Amaretto", price: "8€" },
          { name: "Calvados", price: "8€" },
          { name: "Cognac", price: "9€" },
          { name: "Armagnac", price: "10€" },
          { name: "Belle Gnôle Whisky Châtaigne", price: "8€" },
        ],
      },
    ],
  },
  {
    id: "vins",
    label: "Vins",
    categories: [
      {
        title: "Blancs",
        priceHeader: "Verre 14cl · Tulipe 28cl · Carafe 50cl · Bouteille 75cl",
        items: [
          { name: "Viognier", desc: "Pays d'Oc", price: "5€ · 9€ · 16,50€ · 22€" },
          { name: "Chardonnay", desc: "Bourgogne", price: "6€ · 10,50€ · 17,50€ · 24€" },
          { name: "Colombelle", desc: "Gascogne, Doux", price: "6€ · 11€ · 18€ · 25€" },
          { name: "Chapitre VIII", desc: "Vouvray", price: "— · — · — · 38€" },
          { name: "Le Colombier de Brown", desc: "Pessac Léognan", price: "— · — · — · 45€" },
        ],
      },
      {
        title: "Rosé",
        priceHeader: "Verre 14cl · Tulipe 28cl · Carafe 50cl · Bouteille 75cl",
        items: [
          { name: "Gris de gris", desc: "Pays d'Oc", price: "5€ · 9€ · 16,50€ · 22€" },
          { name: "Cavalier 360", desc: "Provence", price: "7,50€ · 14€ · 24€ · 32€" },
        ],
      },
      {
        title: "Rouge",
        priceHeader: "Verre 14cl · Tulipe 28cl · Carafe 50cl · Bouteille 75cl",
        items: [
          { name: "Merlot", desc: "Pays d'Oc", price: "5€ · 9€ · 16€ · 21€" },
          { name: "Pinot noir", desc: "Pays d'Oc", price: "5,50€ · 10€ · 17€ · 23€" },
          { name: "Château du Lort", desc: "Bordeaux Supérieur", price: "7€ · 13€ · 21€ · 29€" },
          { name: "Châteauneuf-du-Pape", price: "— · — · — · 42€" },
          { name: "Chapitre VII", desc: "Terrasse du Larzac, Bio", price: "— · — · — · 44€" },
          { name: "Le Colombier de Brown", desc: "Pessac Léognan", price: "— · — · — · 49€" },
        ],
      },
      {
        title: "Champagnes des Épicuriens — EPC",
        priceHeader: "Verre/Coupe · Bouteille",
        items: [
          { name: "EPC Brut", price: "12€ · 50€" },
          { name: "EPC Blanc de Noir", price: "— · 75€" },
          { name: "EPC Blanc de Blanc", price: "— · 75€" },
          { name: "EPC Rosé", price: "— · 80€" },
        ],
      },
      {
        title: "Champagnes",
        priceHeader: "Coupe · Bouteille",
        items: [
          { name: "François Dauderet", price: "9€ · 42€" },
          { name: "Ruinart Brut", price: "— · 95€" },
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
          { name: "Cocktails Classiques", desc: "Spritz, Pina Colada, Cuba Libre…", price: "9€ · 16€" },
          { name: "Saint-Germain Spritz", desc: "Saint-Germain, Prosecco, Eau gazeuse", price: "12€ · 20€" },
          { name: "Bombay Tonic", desc: "Gin Bombay, Tonic / Gingembre", price: "10€ · 18€" },
          { name: "La Havane Parisienne", desc: "Rhum Bacardi, St-Germain, Ananas, Citron vert, Menthe", price: "12€ · 22€" },
          { name: "Mojito", desc: "Rhum, Citron vert, Menthe, Sucre, Eau gazeuse", price: "11€ · 19€" },
          { name: "Caïpi / Daïquiri / Caïpiroska", desc: "Alcool, Sucre, Citron vert", price: "11€ · 19€" },
          { name: "Expresso Martini", desc: "Vodka, Kahlua, Expresso", price: "9€ · 16€" },
          { name: "Blue Lagoon", desc: "Vodka, Citron vert, Cassonade, Curaçao", price: "9€ · 16€" },
          { name: "Litchi Martini", desc: "Vodka, Soho, Cranberry", price: "9€ · 16€" },
          { name: "Mule", desc: "Alcool, Citron vert, Cassonade, Ginger Beer", price: "11€ · 19€" },
          { name: "Sex on the Beach", desc: "Vodka, Pêche, Framboise, Orange, Cranberry", price: "11€ · 19€" },
          { name: "Long Island", desc: "Vodka, Rhum, Tequila, Gin, Triple Sec, Citron vert, Coca", price: "12€ · 20€" },
          { name: "Cosmopolitan", desc: "Vodka, Triple Sec, Citron vert, Cranberry", price: "10€ · 18€" },
          { name: "Serendipity", desc: "Calvados, Pomme, Menthe, Champagne", price: "12€ · 20€" },
          { name: "Sour", desc: "Alcool, Sucre, Citron, Blanc d'œuf, Angostura", price: "11€ · 19€" },
        ],
      },
      {
        title: "Cocktails Signatures",
        priceHeader: "Simple · Double",
        items: [
          { name: "Le 5", desc: "Laissez-vous guider", price: "10€ · 18€", bold: true },
          { name: "Patron Paloma", desc: "Tequila Reposado, Citron vert, La French Pamplemousse", price: "12€ · 20€" },
          { name: "French Pornstar", desc: "Grey Goose, Vanille, Passion, Prosecco", price: "12€ · 20€" },
          { name: "White Litchi Martini", desc: "Vodka, Soho, Citron vert", price: "10€ · 10€" },
          { name: "Spicy Margarita", desc: "Tequila Piment, Cointreau, Citron vert", price: "11€ · 19€" },
          { name: "Tarte Citron Meringuée", desc: "Vodka, Limoncello, Blanc d'œuf, Citron, Caramel", price: "11€ · 19€" },
        ],
      },
      {
        title: "Cocktails Sans Alcool",
        items: [
          { name: "Virgin 5", desc: "Laissez-vous guider", price: "8€" },
          { name: "Thé Glacé Maison", desc: "Pêche", price: "6€" },
          { name: "Thé Glacé Marrakech", desc: "Citron, Menthe", price: "6€" },
          { name: "Détox", desc: "Gingembre, Citron vert, Sirop d'Agave", price: "7€" },
          { name: "Crodino Spritz", desc: "Spritz sans alcool de la marque Crodino", price: "8€" },
          { name: "Virgin Mojito", desc: "Sirop de rhum", price: "8€" },
          { name: "Virgin Pina", desc: "Sirop de rhum", price: "8€" },
        ],
      },
      {
        title: "Shooters",
        priceHeader: "Shot · ½ Mètre · Mètre",
        items: [
          { name: "Classique", desc: "Alcool pur, Rhum Arrangé, Spicy Tequila, Baby Guiness, Orgasme", price: "4€ · 15€ · 28€" },
          { name: "Premium", desc: "B50, Jager bomb, Tiramisu, Méduse, Monkey's Brain", price: "5,50€ · 20€ · 35€" },
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
          { name: "Rillettes de Thon", price: "5€" },
          { name: "Rillettes du 5", price: "11€" },
          { name: "Saucisse Sèche", price: "11€" },
          { name: "Toast Tomate × Saumon", desc: "Pain d'épeautre, Tomates séchées, Saumon, Poivrons", price: "9€" },
          { name: "Pain à l'ail", desc: "Pain brioché, Beurre à l'ail", price: "6€" },
          { name: "Stick Mozza", price: "6€" },
          { name: "Tenders de Poulet", price: "6€" },
          { name: "Camembert (150g) Rôti au Miel et Lard", price: "14€" },
          { name: "Sélection de Fromages", desc: "Cantal, Saint-Nectaire, Fourme d'Ambert", price: "15€" },
          { name: "Sélection de Charcuterie", desc: "Saucisson sec, Serrano, Chorizo, Jambon blanc", price: "15€" },
          { name: "Sélection Mixte", desc: "Charcuteries & Fromages", price: "25€" },
          { name: "Planche du 5", desc: "Rillettes de Thon, Pâté du 5, Stick Mozza, Tenders, Sélection mixte", price: "55€", bold: true },
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
          { name: "Œufs Mayonnaise Revisités", desc: "Œufs roses, Sauce gribiche", price: "6€" },
          { name: "Harengs Pomme à l'Huile", desc: "Filets de Harengs, Pommes de terre tièdes", price: "7€" },
          { name: "Terrine du 5", desc: "Terrine de Porc", price: "9€" },
        ],
      },
      {
        title: "Salades",
        items: [
          { name: "Salade Caesar", desc: "Salade Romaine, Poulet, Tomate, Parmesan, Croûtons, Sauce Caesar", price: "14€" },
          { name: "Salade du Berger", desc: "Salade, Toasts de chèvre, Tomates cerises, Croûtons", price: "16€" },
          { name: "Salade Landaise", desc: "Salade, Gésiers, Magret Fumé, Oignons, Croûtons, Tomates cerises", price: "18€" },
        ],
      },
      {
        title: "Woks",
        items: [
          { name: "Wok Végan", desc: "Nouilles de blé, Sauce soja sucrée salée, Légumes sautés", price: "14€" },
          { name: "Wok Poulet", desc: "Poulet mariné, Nouilles de blé, Sauce soja sucrée salée, Légumes sautés", price: "15€" },
          { name: "Wok Crevette", desc: "Crevettes, Nouilles de blé, Sauce soja sucrée salée, Légumes sautés", price: "16€" },
        ],
      },
      {
        title: "Plats",
        items: [
          { name: "Croque-Monsieur", desc: "Frites, Salade", price: "12€" },
          { name: "Croque-Madame", desc: "Frites, Salade", price: "13,50€" },
          { name: "Croque-Truffe", desc: "Frites, Salade", price: "14€" },
          { name: "Tartare de Bœuf à la Française", desc: "Bœuf, Sauce tartare, Câpres, Cornichons, Oignons — Frites, Salade", price: "17,50€" },
          { name: "Burger de Bœuf", desc: "Pain à l'encre de seiche, Steak, Sauce Cheddar, Tomates, Oignons — Frites, Salade", price: "17€" },
          { name: "Andouillette AAAAA", desc: "Andouillette de Vire, Sauce moutarde — Frites, Salade", price: "18€" },
          { name: "Pièce du Boucher", desc: "Frites, Salade", price: "23€", bold: true },
        ],
      },
      {
        title: "Garnitures",
        items: [
          { name: "Frites, Salade, Poêlée de Légumes, Riz…", price: "4€" },
        ],
      },
      {
        title: "Menu Enfant",
        subtitle: "12,50€",
        items: [
          { name: "Sirop ou Jus + Tenders, Sticks Mozza ou Steak Haché — Frites, Salade + Glace au choix", price: "12,50€" },
        ],
      },
    ],
  },
  {
    id: "desserts",
    label: "Desserts",
    categories: [
      {
        title: "Fromages",
        items: [
          { name: "Assiette de Fromages", price: "8€" },
        ],
      },
      {
        title: "Desserts",
        items: [
          { name: "Crème Brûlée", price: "7€" },
          { name: "Tiramisu du Moment", price: "7€" },
          { name: "Île Flottante", price: "8€" },
          { name: "Tarte Tatin", desc: "Glace vanille, Coulis de caramel", price: "10,50€" },
          { name: "Moelleux au Chocolat", desc: "Glace vanille et Chantilly", price: "11€" },
          { name: "Pavlova du Moment", desc: "Déstructurée", price: "9€" },
          { name: "Café Gourmand", price: "11€", bold: true },
        ],
      },
      {
        title: "Glaces & Crêpes",
        items: [
          { name: "Boule de Glaces", desc: "Vanille, Choco, Café, Caramel, Coco, Pistache, Rhum Raisin, Menthe-choc, Fraise, Framboise, Mangue, Citron vert", price: "3€ / 6€ / 8€" },
          { name: "Crêpe Nature, Sucre", price: "3,50€" },
          { name: "Crêpe Nutella, Chocolat noir, Spéculos, Caramel", price: "4,50€" },
        ],
      },
    ],
  },
];

/* ---------- COMPONENT ---------- */

export default function LaCartePage() {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll-spy : trouve la section dont le top a passé l'offset (30% de la viewport)
  useEffect(() => {
    const handleScroll = () => {
      const offset = window.innerHeight * 0.3;
      let current = sections[0].id;
      for (const section of sections) {
        const el = sectionRefs.current.get(section.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top - offset <= 0) current = section.id;
      }
      setActiveSection(current);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
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
            Prix nets en euros, service compris · Carte bancaire acceptée à partir de 5&nbsp;€
            <br />
            L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération
            <br />
            Nos plats peuvent contenir des allergènes — n&apos;hésitez pas à consulter notre équipe
          </p>
        </div>
      </div>
    </WebsiteLayout>
  );
}
