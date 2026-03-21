import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import WebsiteLayout from "../components/WebsiteLayout";

export const metadata: Metadata = {
  title: "Le Restaurant",
  description: "Découvrez Le 5 : brasserie parisienne au coeur de Sucy-en-Brie. Salle de 70 couverts, terrasse de 52 places sur la place du village.",
};

export default function LeRestaurantPage() {
  return (
    <WebsiteLayout><div className="min-h-screen">
      {/* Hero */}
      <section className="relative h-[50vh] min-h-[350px] flex items-end">
        <Image
          src="/images/spritz-terrasse.jpg"
          alt="Terrasse du 5 sur la place du village"
          fill
          className="object-cover"
          priority
          quality={85}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/30 to-transparent" />
        <div className="relative z-10 px-6 pb-10 md:px-12">
          <h1 className="font-serif text-4xl md:text-5xl text-white mb-2">Le Restaurant</h1>
          <p className="text-[#c9a96e] tracking-wide">Bar · Tapas · Brasserie</p>
        </div>
      </section>

      {/* Story */}
      <section className="px-6 py-20 md:px-12 max-w-3xl">
        <h2 className="font-serif text-3xl text-[#e8e0d4] mb-8">Notre Histoire</h2>
        <div className="space-y-5 text-[#b0a899] leading-relaxed text-lg">
          <p>
            Le 5, c&apos;est une affaire de famille. Installé au 4 place du village à Sucy-en-Brie,
            le restaurant est né d&apos;une envie simple : créer un lieu où l&apos;on vient bien manger
            et bien boire, dans une ambiance soignée mais détendue.
          </p>
          <p>
            Baptiste et Géry, père et fils, sont aux commandes. Géry est le visage du restaurant —
            en salle comme en cuisine, il assure une présence chaleureuse et attentive. Baptiste gère
            les coulisses : fournisseurs, stratégie, et le développement de ce lieu qui leur ressemble.
          </p>
          <p>
            L&apos;esprit du 5 ? Une brasserie de style parisien, classe mais accessible. On y sert
            des plats de brasserie bien exécutés, des tapas à partager, et des cocktails signatures
            préparés avec soin.
          </p>
        </div>
      </section>

      {/* Photos */}
      <section className="px-6 md:px-12 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden">
            <Image
              src="/images/bar.jpg"
              alt="Le bar du 5"
              fill
              className="object-cover"
            />
          </div>
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden">
            <Image
              src="/images/bartender.jpg"
              alt="Préparation cocktail"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Capacité */}
      <section className="px-6 py-20 md:px-12 bg-[#0a0a0a]">
        <div className="max-w-3xl">
          <h2 className="font-serif text-3xl text-[#e8e0d4] mb-10">Nos Espaces</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 border border-[#1a1a1a] rounded-lg">
              <p className="font-serif text-4xl text-[#c9a96e] mb-2">70</p>
              <p className="text-[#8a8072] text-sm tracking-wider uppercase">Couverts en salle</p>
            </div>
            <div className="text-center p-8 border border-[#1a1a1a] rounded-lg">
              <p className="font-serif text-4xl text-[#c9a96e] mb-2">52</p>
              <p className="text-[#8a8072] text-sm tracking-wider uppercase">Places en terrasse</p>
            </div>
            <div className="text-center p-8 border border-[#1a1a1a] rounded-lg">
              <p className="font-serif text-4xl text-[#c9a96e] mb-2">122</p>
              <p className="text-[#8a8072] text-sm tracking-wider uppercase">Capacité totale</p>
            </div>
          </div>
        </div>
      </section>

      {/* Ambiance */}
      <section className="px-6 py-20 md:px-12 max-w-3xl">
        <h2 className="font-serif text-3xl text-[#e8e0d4] mb-8">L&apos;Ambiance</h2>
        <div className="space-y-5 text-[#b0a899] leading-relaxed text-lg">
          <p>
            La salle du 5 mêle l&apos;élégance d&apos;une brasserie parisienne et la convivialité
            d&apos;un bar de quartier. Un grand comptoir en bois, des étagères garnies de spiritueux,
            et une atmosphère tamisée qui invite à s&apos;installer.
          </p>
          <p>
            Aux beaux jours, la terrasse s&apos;ouvre sur la place du village — l&apos;endroit idéal
            pour un apéritif au soleil ou un dîner en plein air.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 md:px-12 bg-[#0a0a0a] text-center">
        <h2 className="font-serif text-2xl text-[#e8e0d4] mb-6">
          Venez nous rendre visite
        </h2>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/reserver"
            className="inline-flex items-center bg-[#c9a96e] text-[#111111] px-8 py-3.5 text-sm font-semibold tracking-wider uppercase hover:bg-[#d4b87d] transition-colors rounded"
          >
            Réserver une table
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center border border-[#c9a96e]/40 text-[#c9a96e] px-8 py-3.5 text-sm tracking-wider uppercase hover:bg-[#c9a96e]/10 transition-colors rounded"
          >
            Nous trouver
          </Link>
        </div>
      </section>
    </div></WebsiteLayout>
  );
}
