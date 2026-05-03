"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Reveal, GoldDivider } from "../Motion";

const CONTACT_EMAIL = "glghospitalitypro@gmail.com";

const hours = [
  { day: "Lundi", value: "Fermé", closed: true },
  { day: "Mardi", value: "7h – 22h" },
  { day: "Mercredi", value: "7h – 22h" },
  { day: "Jeudi", value: "7h – Minuit" },
  { day: "Vendredi", value: "7h – 2h" },
  { day: "Samedi", value: "7h – 2h" },
  { day: "Dimanche", value: "7h – 15h" },
];

const faq = [
  {
    q: "Faut-il réserver ?",
    a: "Pour le déjeuner et les week-ends, c'est conseillé. En semaine le soir, on a souvent de la place mais réserver vous garantit votre table.",
  },
  {
    q: "Avez-vous un menu enfant ?",
    a: "Oui — Sirop ou Jus + Tenders, Sticks Mozza ou Steak Haché avec Frites & Salade + glace au choix, à 12,50 €.",
  },
  {
    q: "Avez-vous des options végétariennes ?",
    a: "Oui : wok végan, salades, tapas (rillettes thon, fromages, tartines), assiette de fromages. Précisez les allergies à la commande.",
  },
  {
    q: "Comment se garer ?",
    a: "Parking gratuit place du village (juste devant). Parking de la mairie à 200 m. Gare RER A de Sucy-Bonneuil à 8 min à pied.",
  },
  {
    q: "Vous prenez les groupes ?",
    a: "Oui, jusqu'à 122 personnes (salle + terrasse). Pour les groupes >12, demande de privatisation depuis la page Réserver.",
  },
  {
    q: "Pouvez-vous accueillir un anniversaire surprise ?",
    a: "Bien sûr. Indiquez-le dans les notes de la réservation, on s'arrange pour préparer une table à part et une attention.",
  },
];

export default function ContactContent() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen">
      {/* Hero compact */}
      <section className="relative h-[40vh] min-h-[280px] flex items-end overflow-hidden">
        <Image
          src="/images/place-village-large.webp"
          alt=""
          fill
          priority
          quality={85}
          sizes="(min-width: 1024px) calc(100vw - 280px), 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/60 to-[#111111]/20" />
        <div className="relative z-10 px-6 pb-10 md:px-12 md:pb-12 max-w-3xl">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-[#c9a96e] text-xs tracking-[0.4em] uppercase mb-3"
          >
            Nous trouver
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="font-serif text-4xl md:text-6xl text-white leading-tight"
          >
            On est juste là.
          </motion.h1>
        </div>
      </section>

      {/* Infos principales */}
      <section className="px-6 md:px-12 py-16 md:py-20 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-14">
          <Reveal>
            <p className="text-[#c9a96e] text-xs tracking-[0.3em] uppercase mb-4">Adresse</p>
            <a
              href="https://maps.google.com/?q=4+place+du+village+94370+Sucy-en-Brie"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#e8e0d4] text-lg hover:text-[#c9a96e] transition-colors block leading-relaxed"
            >
              4, place du village
              <br />
              94370 Sucy-en-Brie
            </a>
            <p className="text-[#5a5550] text-xs mt-3">Place piétonne du centre-ville</p>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="text-[#c9a96e] text-xs tracking-[0.3em] uppercase mb-4">Téléphone</p>
            <a href="tel:0983944600" className="text-[#e8e0d4] text-lg hover:text-[#c9a96e] transition-colors">
              09 83 94 46 00
            </a>
            <p className="text-[#5a5550] text-xs mt-3">Pour toute urgence ou réservation immédiate</p>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="text-[#c9a96e] text-xs tracking-[0.3em] uppercase mb-4">Réseaux</p>
            <div className="space-y-2.5">
              <a
                href="https://www.instagram.com/le_5_sucy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#e8e0d4] hover:text-[#c9a96e] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
                @le_5_sucy
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=676862645517185"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#e8e0d4] hover:text-[#c9a96e] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Le 5 sur Facebook
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Horaires + Accès en colonnes */}
      <section className="px-6 md:px-12 py-16 md:py-20 bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
          <Reveal>
            <p className="text-[#c9a96e] text-xs tracking-[0.3em] uppercase mb-5">Horaires</p>
            <div className="space-y-0">
              {hours.map((h) => (
                <div
                  key={h.day}
                  className={`flex justify-between py-3 border-b border-[#1a1a1a] ${
                    h.closed ? "text-[#5a5550]" : "text-[#b0a899]"
                  }`}
                >
                  <span className="tracking-wide">{h.day}</span>
                  <span className={h.closed ? "italic" : "text-[#e8e0d4]"}>{h.value}</span>
                </div>
              ))}
            </div>
            <p className="text-[#5a5550] text-xs mt-4">
              Horaires susceptibles de varier selon les événements et jours fériés.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <p className="text-[#c9a96e] text-xs tracking-[0.3em] uppercase mb-5">Comment venir</p>
            <div className="space-y-5 text-[#b0a899] text-sm leading-relaxed">
              <div>
                <p className="text-[#e8e0d4] font-medium mb-1">🚗 En voiture</p>
                <p>Place du village (gratuit, 30 places). Parking de la mairie à 200 m si plein.</p>
              </div>
              <div>
                <p className="text-[#e8e0d4] font-medium mb-1">🚇 RER A</p>
                <p>Station Sucy-Bonneuil → 8 min à pied (rue du Temple, traverser la place).</p>
              </div>
              <div>
                <p className="text-[#e8e0d4] font-medium mb-1">🚌 Bus</p>
                <p>Lignes 308, 393, J3, Tim → arrêt « Église / Place du Village ».</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Maps */}
      <section className="h-[400px] w-full bg-[#0a0a0a] relative">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2628.9!2d2.5220481!3d48.7705271!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47e60bb763d62f43%3A0x14d09ffaf314fabd!2sLE%205!5e0!3m2!1sfr!2sfr!4v1"
          width="100%"
          height="100%"
          style={{ border: 0, filter: "invert(90%) hue-rotate(180deg) saturate(0.3) brightness(0.85)" }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Le 5 — Place du village, Sucy-en-Brie"
        />
      </section>

      {/* FAQ */}
      <section className="px-6 md:px-12 py-20 md:py-28 max-w-4xl mx-auto">
        <Reveal>
          <GoldDivider label="Questions fréquentes" className="mb-12" />
        </Reveal>
        <div className="space-y-2">
          {faq.map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <Reveal key={i} delay={i * 0.05}>
                <button
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="w-full flex items-center justify-between text-left py-5 border-b border-[#1f1c18] hover:border-[#c9a96e]/40 transition-colors group"
                >
                  <span className="font-serif text-lg md:text-xl text-[#e8e0d4] group-hover:text-[#c9a96e] transition-colors pr-6">
                    {item.q}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    className="text-[#c9a96e] text-2xl shrink-0"
                  >
                    +
                  </motion.span>
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="py-4 text-[#b0a899] leading-relaxed">{item.a}</p>
                </motion.div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Nous écrire — mailto direct */}
      <section className="relative px-6 md:px-12 py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/terrasse-parasols.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-15"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/95 to-[#0a0a0a]" />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <Reveal>
            <p className="text-[#c9a96e] text-xs tracking-[0.4em] uppercase mb-4">
              Nous écrire
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-[#e8e0d4] mb-6">
              Une question, une remarque ?
            </h2>
            <p className="text-[#b0a899] leading-relaxed mb-10">
              Pour toute demande — réservation de groupe, allergie particulière, événement,
              ou un simple message — écrivez-nous, on répond dans la journée.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3">
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Le 5 — message via le site")}`}
                className="inline-flex items-center justify-center gap-3 bg-[#c9a96e] text-[#111111] px-8 py-4 rounded-lg font-semibold tracking-[0.05em] hover:bg-[#d4b87d] transition-colors"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <span>{CONTACT_EMAIL}</span>
              </a>
              <a
                href="tel:0983944600"
                className="inline-flex items-center justify-center gap-3 border border-[#c9a96e]/40 text-[#c9a96e] px-8 py-4 rounded-lg hover:bg-[#c9a96e]/10 hover:border-[#c9a96e] transition-colors"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                <span>09 83 94 46 00</span>
              </a>
            </div>
            <p className="text-center text-xs text-[#5a5550] mt-6">
              Pour réserver une table,{" "}
              <Link href="/reserver" className="text-[#c9a96e] hover:underline">
                utilisez la page réservation
              </Link>
              .
            </p>
          </Reveal>
        </div>
      </section>

      {/* CTA réservation */}
      <section className="px-6 py-16 md:px-12 md:py-20 text-center bg-[#111111]">
        <Reveal>
          <Link
            href="/reserver"
            className="inline-flex items-center gap-2 bg-[#c9a96e] text-[#111111] px-8 py-3.5 text-sm font-semibold tracking-[0.15em] uppercase hover:bg-[#d4b87d] transition-colors rounded"
          >
            Réserver une table
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
