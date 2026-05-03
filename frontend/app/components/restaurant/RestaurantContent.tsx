"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Reveal, KenBurnsImage, GoldDivider, ParallaxImage, MagneticHover } from "../Motion";

const espaces = [
  {
    id: "salle",
    label: "La Salle",
    capacity: "70 couverts",
    image: "/images/salle-vue-ensemble.webp",
    imageAlt: "La salle du 5 — banquettes, bar et tables",
    paragraphs: [
      "Une grande salle pensée comme une vraie brasserie : banquettes confortables, comptoir bois, miroirs, lumières chaudes. On y mange aussi bien à deux qu'en famille ou avec une bande d'amis.",
      "Le service est continu — entrer pour un café, ressortir une heure plus tard avec un verre, c'est totalement possible.",
    ],
    align: "left" as const,
  },
  {
    id: "bar",
    label: "Le Bar",
    capacity: "Cocktails, vins, bières pression",
    image: "/images/cocktail-dragon.webp",
    imageAlt: "Cocktail signature du 5",
    paragraphs: [
      "Une belle sélection de spiritueux, des cocktails classiques bien faits, des signatures bien à nous, et trois pressions Deck & Donohue brassées à Bonneuil-sur-Marne.",
      "Côté vin, on mise sur des références abordables au verre comme à la bouteille, avec quelques pépites sur la carte longue.",
    ],
    align: "right" as const,
  },
  {
    id: "terrasse",
    label: "La Terrasse",
    capacity: "52 places, ombragée, chauffée l'hiver",
    image: "/images/terrasse-tables-soir.webp",
    imageAlt: "La terrasse du 5 sur la place du village au soir",
    paragraphs: [
      "Pleine sud sur la place du village, la terrasse est l'âme du 5 dès qu'il fait beau. Parasols l'été, chauffages et plaids l'hiver, on y reste jusque tard.",
      "C'est aussi l'endroit idéal pour un afterwork, un brunch dominical ou un apéritif au coucher du soleil.",
    ],
    align: "left" as const,
  },
];

export default function RestaurantContent() {
  return (
    <>
      {/* HERO */}
      <section className="relative h-[70vh] min-h-[480px] flex items-end overflow-hidden">
        <KenBurnsImage
          src="/images/place-village-large.webp"
          alt="La terrasse du 5 sur la place du village de Sucy-en-Brie"
          priority
          quality={88}
          duration={20}
          sizes="(min-width: 1024px) calc(100vw - 280px), 100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/50 to-[#111111]/10" />

        <div className="relative z-10 px-6 pb-12 md:px-12 md:pb-16 max-w-3xl">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="text-[#c9a96e] text-xs tracking-[0.4em] uppercase mb-4"
          >
            Le Restaurant
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-4xl md:text-6xl lg:text-7xl text-white leading-[0.95] mb-3"
          >
            Bar, brasserie,
            <br />
            <span className="text-[#c9a96e]">place du village.</span>
          </motion.h1>
        </div>
      </section>

      {/* INTRO */}
      <section className="px-6 py-24 md:px-12 md:py-32 max-w-4xl mx-auto">
        <Reveal>
          <GoldDivider label="L'esprit Le 5" className="mb-12" />
        </Reveal>
        <Reveal delay={0.15}>
          <p className="font-serif text-2xl md:text-3xl text-[#e8e0d4] leading-tight md:leading-[1.3] mb-8">
            On a voulu une adresse simple :
            <span className="text-[#c9a96e]"> bien manger, bien boire</span>,
            sans chichis et sans se ruiner.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="space-y-5 text-[#b0a899] text-base md:text-lg leading-relaxed">
            <p>
              Le 5, c&apos;est une brasserie de style parisien plantée au coeur de Sucy-en-Brie,
              sur la place du village. Trois ambiances en une seule adresse :
              une grande salle, un bar à cocktails, et une terrasse qu&apos;on aime particulièrement
              quand il fait beau.
            </p>
            <p>
              On ouvre tôt, on ferme tard. On sert le café du matin, le déjeuner du midi,
              les apéritifs de fin d&apos;après-midi, le dîner du soir, et les verres qui font durer
              la nuit. Cuisine maison, ardoise renouvelée, carte qu&apos;on connaît par coeur.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ESPACES — alternance gauche/droite */}
      <div>
        {espaces.map((e) => (
          <section
            key={e.id}
            id={e.id}
            className="px-6 md:px-12 py-16 md:py-24 max-w-7xl mx-auto scroll-mt-20"
          >
            <div
              className={`grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center ${
                e.align === "right" ? "md:[&>div:first-child]:order-last" : ""
              }`}
            >
              <Reveal variant={e.align === "left" ? "fadeUp" : "fadeUp"}>
                <div className="relative aspect-[4/5] md:aspect-[3/4] rounded-lg overflow-hidden group">
                  <Image
                    src={e.image}
                    alt={e.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 45vw, 100vw"
                    className="object-cover transition-transform duration-[1.5s] group-hover:scale-105"
                  />
                </div>
              </Reveal>
              <Reveal delay={0.15}>
                <p className="text-[#c9a96e] text-xs tracking-[0.4em] uppercase mb-3">
                  {e.capacity}
                </p>
                <h2 className="font-serif text-3xl md:text-5xl text-[#e8e0d4] leading-tight mb-7">
                  {e.label}
                </h2>
                <div className="space-y-4 text-[#b0a899] leading-relaxed">
                  {e.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </Reveal>
            </div>
          </section>
        ))}
      </div>

      {/* PARALLAX */}
      <ParallaxImage
        src="/images/place-village-soir.webp"
        alt="Le 5 vu de la place du village le soir"
        className="h-[55vh] min-h-[380px]"
        sizes="100vw"
        strength={0.35}
      />

      {/* CUISINE MAISON */}
      <section className="px-6 py-24 md:px-12 md:py-32 bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <GoldDivider label="Cuisine maison" className="mb-12" />
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-start">
            <Reveal>
              <h2 className="font-serif text-3xl md:text-4xl text-[#e8e0d4] leading-tight mb-6">
                Faite ici,
                <br />
                <span className="text-[#c9a96e]">avec ce qu&apos;on aime.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="space-y-4 text-[#b0a899] leading-relaxed">
                <p>
                  Pas de surgelés industriels. La majorité des plats sont préparés sur place :
                  tartare au couteau, frites maison, terrine du 5, sauces, vinaigrettes, desserts.
                </p>
                <p>
                  La carte tourne autour des classiques de brasserie qu&apos;on aime —
                  croque-monsieur, andouillette AAAAA, salades généreuses, woks au goût asiatique,
                  burger au pain noir, planches à partager.
                </p>
                <Link
                  href="/la-carte"
                  className="inline-flex items-center gap-2 text-[#c9a96e] text-sm tracking-[0.2em] uppercase border-b border-[#c9a96e]/40 pb-1 hover:border-[#c9a96e] transition-colors mt-3"
                >
                  Voir la carte
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* PRIVATISATION */}
      <section className="relative px-6 md:px-12 py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/terrasse-parasols.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111111] via-[#111111]/85 to-[#111111]/55" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <Reveal>
            <p className="text-[#c9a96e] text-xs tracking-[0.4em] uppercase mb-5">
              Privatisation
            </p>
            <h2 className="font-serif text-3xl md:text-5xl text-white leading-tight mb-6">
              Une soirée, un anniversaire,
              <br />
              <span className="text-[#c9a96e]">un séminaire ?</span>
            </h2>
            <p className="text-[#cfc7b9] text-base md:text-lg leading-relaxed mb-8 max-w-xl">
              On peut privatiser la salle (jusqu&apos;à 70 couverts), la terrasse (52 places),
              ou tout le restaurant pour les grosses occasions. Menu adapté, formule cocktails,
              ou carte habituelle — on s&apos;arrange.
            </p>
            <MagneticHover className="inline-block">
              <Link
                href="/reserver?mode=privatisation"
                className="inline-flex items-center gap-2 bg-[#c9a96e] text-[#111111] px-8 py-3.5 text-sm font-semibold tracking-[0.15em] uppercase hover:bg-[#d4b87d] transition-all rounded"
              >
                Demander une privatisation
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </MagneticHover>
          </Reveal>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-6 py-24 md:px-12 md:py-28 text-center bg-[#0a0a0a]">
        <Reveal>
          <h2 className="font-serif text-3xl md:text-4xl text-[#e8e0d4] mb-8">
            Venir au 5
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/reserver"
              className="inline-flex items-center gap-2 bg-[#c9a96e] text-[#111111] px-8 py-3.5 text-sm font-semibold tracking-[0.15em] uppercase hover:bg-[#d4b87d] transition-colors rounded"
            >
              Réserver une table
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 border border-[#c9a96e]/40 text-[#c9a96e] px-8 py-3.5 text-sm tracking-[0.15em] uppercase hover:bg-[#c9a96e]/10 transition-colors rounded"
            >
              Nous trouver
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
