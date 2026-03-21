import Image from "next/image";
import Link from "next/link";
import WebsiteLayout from "./components/WebsiteLayout";

export const metadata = {
  title: "Le 5 — Bar · Tapas · Brasserie",
  description: "Le 5, bar tapas brasserie au coeur de Sucy-en-Brie. Cuisine de brasserie, cocktails signatures et ambiance chaleureuse sur la place du village.",
};

const hours = [
  { day: "Lundi", value: "Fermé", closed: true },
  { day: "Mardi", value: "7h – 22h" },
  { day: "Mercredi", value: "7h – 22h" },
  { day: "Jeudi", value: "7h – Minuit" },
  { day: "Vendredi", value: "7h – 2h" },
  { day: "Samedi", value: "7h – 2h" },
  { day: "Dimanche", value: "7h – 15h" },
];

export default function HomePage() {
  return (
    <WebsiteLayout><div>
      {/* Hero Section */}
      <section className="relative h-[85vh] min-h-[500px] flex items-end">
        <Image
          src="/images/hero-terrasse.jpg"
          alt="Terrasse du restaurant Le 5 à Sucy-en-Brie"
          fill
          className="object-cover"
          priority
          quality={85}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/40 to-transparent" />

        <div className="relative z-10 w-full px-6 pb-12 md:px-12 md:pb-16 max-w-3xl">
          <h1 className="font-serif text-4xl md:text-6xl text-white mb-4 leading-tight">
            Bar · Tapas · Brasserie
          </h1>
          <p className="text-[#c9a96e] text-lg md:text-xl font-light tracking-wide mb-8">
            Au coeur de Sucy-en-Brie, sur la place du village
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/reserver"
              className="inline-flex items-center gap-2 bg-[#c9a96e] text-[#111111] px-8 py-3.5 text-sm font-semibold tracking-wider uppercase hover:bg-[#d4b87d] transition-colors rounded"
            >
              Réserver une table
            </Link>
            <Link
              href="/la-carte"
              className="inline-flex items-center gap-2 border border-[#c9a96e]/40 text-[#c9a96e] px-8 py-3.5 text-sm tracking-wider uppercase hover:bg-[#c9a96e]/10 transition-colors rounded"
            >
              Voir la carte
            </Link>
          </div>
        </div>
      </section>

      {/* Concept Section */}
      <section className="px-6 py-20 md:px-12 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-px flex-1 bg-gradient-to-r from-[#c9a96e]/40 to-transparent" />
          <span className="text-[#c9a96e] text-sm tracking-[0.3em] uppercase">Notre Concept</span>
          <div className="h-px flex-1 bg-gradient-to-l from-[#c9a96e]/40 to-transparent" />
        </div>
        <p className="text-lg md:text-xl text-[#b0a899] leading-relaxed text-center max-w-2xl mx-auto">
          Une brasserie de style parisien, classe mais abordable. On vient chez nous pour bien manger
          et bien boire, dans une atmosphère soignée et détendue — au coeur de la place du village
          de Sucy-en-Brie.
        </p>
      </section>

      {/* Photo Grid */}
      <section className="px-6 md:px-12 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 max-w-5xl">
          <div className="relative aspect-[4/5] rounded-lg overflow-hidden col-span-2 md:col-span-1 md:row-span-2">
            <Image
              src="/images/bar.jpg"
              alt="Le bar du 5"
              fill
              className="object-cover hover:scale-105 transition-transform duration-700"
            />
          </div>
          <div className="relative aspect-square rounded-lg overflow-hidden">
            <Image
              src="/images/cocktail-dragon.jpg"
              alt="Cocktail signature"
              fill
              className="object-cover hover:scale-105 transition-transform duration-700"
            />
          </div>
          <div className="relative aspect-square rounded-lg overflow-hidden">
            <Image
              src="/images/wok-poulet.jpg"
              alt="Wok de poulet"
              fill
              className="object-cover hover:scale-105 transition-transform duration-700"
            />
          </div>
          <div className="relative aspect-square rounded-lg overflow-hidden">
            <Image
              src="/images/spritz-terrasse.jpg"
              alt="Spritz en terrasse"
              fill
              className="object-cover hover:scale-105 transition-transform duration-700"
            />
          </div>
          <div className="relative aspect-square rounded-lg overflow-hidden">
            <Image
              src="/images/skull-bar.jpg"
              alt="Ambiance bar Le 5"
              fill
              className="object-cover hover:scale-105 transition-transform duration-700"
            />
          </div>
        </div>
      </section>

      {/* Hours Section */}
      <section className="px-6 py-20 md:px-12 bg-[#0a0a0a]">
        <div className="max-w-lg mx-auto">
          <h2 className="font-serif text-3xl text-center text-[#e8e0d4] mb-10">
            Horaires d&apos;ouverture
          </h2>
          <div className="space-y-0">
            {hours.map((h) => (
              <div
                key={h.day}
                className={`flex justify-between py-3 border-b border-[#1a1a1a] ${
                  h.closed ? "text-[#5a5550]" : "text-[#b0a899]"
                }`}
              >
                <span className="tracking-wide">{h.day}</span>
                <span className={h.closed ? "italic" : "text-[#e8e0d4]"}>
                  {h.value}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[#5a5550] text-xs text-center mt-6">
            Horaires susceptibles de varier selon les événements.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 md:px-12 text-center">
        <h2 className="font-serif text-3xl text-[#e8e0d4] mb-4">
          Envie de passer nous voir ?
        </h2>
        <p className="text-[#8a8072] mb-8">
          Réservez votre table en quelques clics.
        </p>
        <Link
          href="/reserver"
          className="inline-flex items-center gap-2 bg-[#c9a96e] text-[#111111] px-10 py-4 text-sm font-semibold tracking-wider uppercase hover:bg-[#d4b87d] transition-colors rounded"
        >
          Réserver maintenant
        </Link>
      </section>

      {/* Bottom address bar */}
      <section className="px-6 py-8 md:px-12 bg-[#0a0a0a] border-t border-[#1a1a1a]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#8a8072] max-w-4xl mx-auto">
          <span>4, place du village — 94370 Sucy-en-Brie</span>
          <a href="tel:0983944600" className="hover:text-[#c9a96e] transition-colors">
            09 83 94 46 00
          </a>
          <div className="flex gap-4">
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
    </div></WebsiteLayout>
  );
}
