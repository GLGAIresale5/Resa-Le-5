"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Reveal,
  StaggerGroup,
  StaggerItem,
  KenBurnsImage,
  ParallaxImage,
  GoldDivider,
  MagneticHover,
} from "../Motion";

const hours = [
  { day: "Lundi", value: "Fermé", closed: true },
  { day: "Mardi", value: "7h – 22h" },
  { day: "Mercredi", value: "7h – 22h" },
  { day: "Jeudi", value: "7h – 00h" },
  { day: "Vendredi", value: "7h – 2h" },
  { day: "Samedi", value: "7h – 2h" },
  { day: "Dimanche", value: "7h – 15h" },
];

const espaces = [
  {
    title: "La Salle",
    desc: "70 couverts, ambiance feutrée, banquettes & comptoir bois.",
    image: "/images/salle-vue-ensemble.webp",
    href: "/le-restaurant#salle",
  },
  {
    title: "La Terrasse",
    desc: "52 places sur la place du village, à l'ombre l'été, sous parasols toute l'année.",
    image: "/images/terrasse-tables-soir.webp",
    href: "/le-restaurant#terrasse",
  },
  {
    title: "Le Bar",
    desc: "Cocktails signatures, vins choisis, bières pression Deck & Donohue brassées en Île-de-France.",
    image: "/images/cocktail-dragon.webp",
    href: "/le-restaurant#bar",
  },
];

const signatures = [
  {
    title: "Cocktails signatures",
    line: "Le 5, Patron Paloma, French Pornstar…",
    image: "/images/spritz-terrasse.webp",
  },
  {
    title: "Brasserie",
    line: "Tartare de bœuf, andouillette AAAAA, woks, croque-truffe.",
    image: "/images/wok-poulet.webp",
  },
  {
    title: "Tapas à partager",
    line: "Planches charcuterie, fromages, camembert au miel.",
    image: "/images/salle-table-banquette.webp",
  },
];

// Vrais avis Google — fiche LE 5 Sucy-en-Brie (4,2★ · 98 avis)
const reviews = [
  {
    author: "Jacques Leboulanger",
    rating: 5,
    text: "Déjeuner dimanche dernier entre amis. Accueil et service très sympathiques et professionnels. Bœuf gros sel à l'os à moelle, vraiment très bon.",
    source: "Google",
  },
  {
    author: "Stéphane Lery",
    rating: 5,
    text: "J'aime y manger le midi, et le soir autour d'un cocktail entre amis. Pas déçu du service ni de l'accueil. Une belle adresse, je vous la recommande !",
    source: "Google",
  },
  {
    author: "Dadidou TV",
    rating: 5,
    text: "Burger classique vraiment très bon, écrasé de pommes de terre au top. Personnel très sympa — ça fait plaisir de voir des gens apprécier leur métier.",
    source: "Google",
  },
];

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? "text-[#c9a96e]" : "text-[#3a3530]"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
        </svg>
      ))}
    </div>
  );
}

export default function HomeContent() {
  return (
    <>
      {/* HERO — Ken Burns plein écran */}
      <section className="relative h-[100svh] min-h-[560px] flex items-end overflow-hidden">
        <KenBurnsImage
          src="/images/place-le5-soir.webp"
          alt="La terrasse du 5 sur la place du village de Sucy-en-Brie au crépuscule"
          priority
          quality={88}
          direction="in"
          duration={22}
          sizes="(min-width: 1024px) calc(100vw - 280px), 100vw"
        />
        {/* Gradient noir bas → transparent haut */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/55 to-[#111111]/10" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#111111]/70 to-transparent" />

        <div className="relative z-10 w-full px-6 pb-16 md:px-12 md:pb-20">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-[#c9a96e] text-xs md:text-sm tracking-[0.4em] uppercase mb-5"
          >
            Sucy-en-Brie · Place du Village
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-5xl md:text-7xl lg:text-8xl text-white leading-[0.95] mb-6 max-w-4xl"
          >
            Bar · Tapas
            <br />
            <span className="text-[#c9a96e]">Brasserie</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="text-[#cfc7b9] text-base md:text-lg max-w-xl mb-10 font-light"
          >
            Une brasserie de style parisien, classe mais abordable.
            On vient pour bien manger, bien boire, et passer un bon moment.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.95, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap gap-3"
          >
            <MagneticHover>
              <Link
                href="/reserver"
                className="inline-flex items-center gap-2 bg-[#c9a96e] text-[#111111] px-8 py-4 text-sm font-semibold tracking-[0.15em] uppercase hover:bg-[#d4b87d] transition-all rounded shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-[#c9a96e]/20"
              >
                Réserver une table
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </MagneticHover>
            <Link
              href="/la-carte"
              className="inline-flex items-center gap-2 border border-[#c9a96e]/40 text-[#c9a96e] px-8 py-4 text-sm tracking-[0.15em] uppercase hover:bg-[#c9a96e]/10 hover:border-[#c9a96e] transition-all rounded backdrop-blur-sm"
            >
              Voir la carte
            </Link>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 1 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 z-10"
        >
          <span className="text-[10px] text-[#8a8072] tracking-[0.3em] uppercase">Découvrir</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-px h-8 bg-gradient-to-b from-[#c9a96e] to-transparent"
          />
        </motion.div>
      </section>

      {/* CONCEPT */}
      <section className="px-6 py-24 md:px-12 md:py-32 max-w-5xl mx-auto">
        <Reveal>
          <GoldDivider label="Le 5" className="mb-10" />
        </Reveal>
        <Reveal delay={0.15}>
          <p className="font-serif text-2xl md:text-4xl text-[#e8e0d4] leading-tight md:leading-[1.2] text-center max-w-3xl mx-auto">
            Au coeur de Sucy-en-Brie, le rendez-vous quotidien de ceux qui aiment{" "}
            <span className="text-[#c9a96e] italic">prendre le temps</span>.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <p className="text-[#8a8072] text-base md:text-lg leading-relaxed text-center max-w-2xl mx-auto mt-8">
            Café du matin, déjeuner sur le pouce, apéritif au soleil, dîner entre amis,
            verre tard le soir : on ouvre tôt, on ferme tard, et on cuisine maison.
          </p>
        </Reveal>
      </section>

      {/* ESPACES — 3 cartes */}
      <section className="px-6 md:px-12 pb-24 md:pb-32">
        <StaggerGroup className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-7xl mx-auto">
          {espaces.map((e) => (
            <StaggerItem key={e.title}>
              <Link href={e.href} className="group relative block aspect-[4/5] overflow-hidden rounded-lg">
                <Image
                  src={e.image}
                  alt={e.title}
                  fill
                  sizes="(min-width: 1024px) 30vw, 100vw"
                  className="object-cover transition-transform duration-[1.2s] group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/40 to-transparent group-hover:via-[#111111]/30 transition-all duration-500" />
                <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                  <p className="text-[#c9a96e] text-[10px] tracking-[0.3em] uppercase mb-2 opacity-90">
                    Découvrir
                  </p>
                  <h3 className="font-serif text-2xl md:text-3xl text-white mb-2">{e.title}</h3>
                  <p className="text-[#cfc7b9] text-sm leading-relaxed max-w-xs">{e.desc}</p>
                  <div className="h-px bg-[#c9a96e] w-0 group-hover:w-12 transition-all duration-500 mt-4" />
                </div>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* PARALLAX FULL BLEED */}
      <ParallaxImage
        src="/images/place-village-soir.webp"
        alt="La place du village de Sucy-en-Brie le soir"
        className="h-[60vh] min-h-[400px]"
        sizes="100vw"
        strength={0.4}
      />

      {/* SIGNATURES */}
      <section className="px-6 py-24 md:px-12 md:py-32 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <GoldDivider label="Ce qu'on aime servir" className="mb-12" />
          </Reveal>
          <StaggerGroup className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {signatures.map((s) => (
              <StaggerItem key={s.title}>
                <div className="group">
                  <div className="relative aspect-[4/5] rounded-lg overflow-hidden mb-5">
                    <Image
                      src={s.image}
                      alt={s.title}
                      fill
                      sizes="(min-width: 1024px) 30vw, 100vw"
                      className="object-cover transition-transform duration-[1.2s] group-hover:scale-105"
                    />
                  </div>
                  <h3 className="font-serif text-xl text-[#e8e0d4] mb-1">{s.title}</h3>
                  <p className="text-[#8a8072] text-sm">{s.line}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
          <Reveal delay={0.3}>
            <div className="flex justify-center mt-14">
              <Link
                href="/la-carte"
                className="inline-flex items-center gap-2 text-[#c9a96e] text-sm tracking-[0.2em] uppercase border-b border-[#c9a96e]/40 pb-1 hover:border-[#c9a96e] transition-colors"
              >
                Voir la carte complète
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* AVIS GOOGLE */}
      <section className="px-6 py-24 md:px-12 md:py-32 max-w-7xl mx-auto">
        <Reveal>
          <GoldDivider label="Ils en parlent" className="mb-14" />
        </Reveal>
        <StaggerGroup className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {reviews.map((r, i) => (
            <StaggerItem key={i}>
              <div className="h-full p-7 md:p-8 border border-[#1f1c18] rounded-lg bg-gradient-to-br from-[#161412] to-[#0f0e0c] hover:border-[#c9a96e]/30 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <Stars rating={r.rating} />
                  <span className="text-[10px] text-[#5a5550] tracking-[0.2em] uppercase">{r.source}</span>
                </div>
                <p className="text-[#cfc7b9] text-[15px] leading-relaxed mb-5 italic font-light">
                  &laquo;&nbsp;{r.text}&nbsp;&raquo;
                </p>
                <p className="text-[#8a8072] text-sm">— {r.author}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
        <Reveal delay={0.3}>
          <div className="flex flex-col items-center gap-2 mt-12">
            <div className="flex items-center gap-3">
              <Stars rating={5} />
              <span className="text-[#e8e0d4] font-medium">4,2/5</span>
              <span className="text-[#8a8072] text-sm">·</span>
              <span className="text-[#8a8072] text-sm">98 avis Google</span>
            </div>
            <a
              href="https://www.google.com/maps?cid=1499874576083253949"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#c9a96e] text-sm tracking-[0.2em] uppercase border-b border-[#c9a96e]/40 pb-1 hover:border-[#c9a96e] transition-colors mt-2"
            >
              Voir tous les avis
            </a>
          </div>
        </Reveal>
      </section>

      {/* PRIVATISATION — mention courte */}
      <section className="relative px-6 md:px-12 py-24 md:py-28 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/place-village-large.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111111] via-[#111111]/85 to-[#111111]/60" />
        </div>
        <Reveal className="relative z-10 max-w-2xl">
          <p className="text-[#c9a96e] text-xs tracking-[0.4em] uppercase mb-4">Groupes & Événements</p>
          <h2 className="font-serif text-3xl md:text-5xl text-white leading-tight mb-5">
            On privatise.
          </h2>
          <p className="text-[#cfc7b9] text-base md:text-lg leading-relaxed mb-8 max-w-xl">
            Anniversaire, séminaire, repas d&apos;équipe, pot de départ : la salle, la terrasse,
            ou tout le restaurant. Demande directement depuis la page de réservation.
          </p>
          <Link
            href="/reserver?mode=privatisation"
            className="inline-flex items-center gap-2 text-[#c9a96e] text-sm tracking-[0.2em] uppercase border-b border-[#c9a96e]/40 pb-1 hover:border-[#c9a96e] transition-colors"
          >
            Demander une privatisation
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </Reveal>
      </section>

      {/* HORAIRES */}
      <section className="px-6 py-24 md:px-12 md:py-32 bg-[#0a0a0a]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 max-w-5xl mx-auto items-center">
          <Reveal>
            <p className="text-[#c9a96e] text-xs tracking-[0.4em] uppercase mb-4">Horaires</p>
            <h2 className="font-serif text-3xl md:text-5xl text-[#e8e0d4] leading-tight mb-6">
              Ouvert 6 jours sur 7,
              <br />
              <span className="text-[#c9a96e]">tôt le matin, tard le soir.</span>
            </h2>
            <p className="text-[#8a8072] leading-relaxed">
              On démarre la journée au café et on la termine au cocktail.
              Service en continu, cuisine ouverte du midi à minuit selon les jours.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="space-y-0">
              {hours.map((h) => (
                <div
                  key={h.day}
                  className={`flex justify-between py-3.5 border-b border-[#1a1a1a] ${
                    h.closed ? "text-[#5a5550]" : "text-[#b0a899]"
                  }`}
                >
                  <span className="tracking-wide">{h.day}</span>
                  <span className={h.closed ? "italic" : "text-[#e8e0d4]"}>{h.value}</span>
                </div>
              ))}
            </div>
            <p className="text-[#5a5550] text-xs text-center mt-5">
              Horaires susceptibles de varier selon les événements.
            </p>
          </Reveal>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative px-6 py-28 md:px-12 md:py-36 text-center overflow-hidden">
        <Reveal>
          <p className="text-[#c9a96e] text-xs tracking-[0.4em] uppercase mb-5">À très vite</p>
          <h2 className="font-serif text-4xl md:text-6xl text-[#e8e0d4] mb-10 leading-tight">
            On vous garde
            <br />
            une table ?
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <MagneticHover className="inline-block">
            <Link
              href="/reserver"
              className="inline-flex items-center gap-2 bg-[#c9a96e] text-[#111111] px-12 py-5 text-sm font-semibold tracking-[0.2em] uppercase hover:bg-[#d4b87d] transition-all rounded shadow-lg shadow-black/30 hover:shadow-xl hover:shadow-[#c9a96e]/20"
            >
              Réserver maintenant
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </MagneticHover>
        </Reveal>
      </section>

      {/* FOOTER ADRESSE */}
      <section className="px-6 py-10 md:px-12 bg-[#0a0a0a] border-t border-[#1a1a1a]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#8a8072] max-w-5xl mx-auto">
          <a
            href="https://maps.google.com/?q=4+place+du+village+94370+Sucy-en-Brie"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#c9a96e] transition-colors"
          >
            4, place du village — 94370 Sucy-en-Brie
          </a>
          <a href="tel:0983944600" className="hover:text-[#c9a96e] transition-colors">
            09 83 94 46 00
          </a>
          <div className="flex gap-5">
            <a
              href="https://www.instagram.com/le_5_sucy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#c9a96e] transition-colors"
            >
              Instagram
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=676862645517185"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#c9a96e] transition-colors"
            >
              Facebook
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
