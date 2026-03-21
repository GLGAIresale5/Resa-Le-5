import type { Metadata } from "next";
import Link from "next/link";
import WebsiteLayout from "../components/WebsiteLayout";

export const metadata: Metadata = {
  title: "Contact",
  description: "Retrouvez Le 5 au 4 place du village, 94370 Sucy-en-Brie. Horaires, téléphone et plan d'accès.",
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

export default function ContactPage() {
  return (
    <WebsiteLayout><div className="min-h-screen">
      {/* Header */}
      <div className="px-6 py-16 md:px-12">
        <h1 className="font-serif text-4xl md:text-5xl text-[#e8e0d4] mb-3">Contact</h1>
        <p className="text-[#8a8072]">Retrouvez-nous sur la place du village</p>
      </div>

      <div className="px-6 md:px-12 pb-20 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Left column - Info */}
          <div className="space-y-10">
            {/* Address */}
            <div>
              <h2 className="text-[#c9a96e] text-sm tracking-[0.2em] uppercase mb-4">Adresse</h2>
              <a
                href="https://maps.google.com/?q=4+place+du+village+94370+Sucy-en-Brie"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#e8e0d4] text-lg hover:text-[#c9a96e] transition-colors"
              >
                4, place du village<br />
                94370 Sucy-en-Brie
              </a>
            </div>

            {/* Phone */}
            <div>
              <h2 className="text-[#c9a96e] text-sm tracking-[0.2em] uppercase mb-4">Téléphone</h2>
              <a
                href="tel:0983944600"
                className="text-[#e8e0d4] text-lg hover:text-[#c9a96e] transition-colors"
              >
                09 83 94 46 00
              </a>
            </div>

            {/* Social */}
            <div>
              <h2 className="text-[#c9a96e] text-sm tracking-[0.2em] uppercase mb-4">Réseaux sociaux</h2>
              <div className="space-y-3">
                <a
                  href="https://www.instagram.com/le_5_sucy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-[#e8e0d4] hover:text-[#c9a96e] transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  @le_5_sucy
                </a>
                <a
                  href="https://www.facebook.com/profile.php?id=676862645517185"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-[#e8e0d4] hover:text-[#c9a96e] transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Le 5 sur Facebook
                </a>
              </div>
            </div>

            {/* Reservation CTA */}
            <div>
              <Link
                href="/reserver"
                className="inline-flex items-center bg-[#c9a96e] text-[#111111] px-8 py-3.5 text-sm font-semibold tracking-wider uppercase hover:bg-[#d4b87d] transition-colors rounded"
              >
                Réserver une table
              </Link>
            </div>
          </div>

          {/* Right column - Hours */}
          <div>
            <h2 className="text-[#c9a96e] text-sm tracking-[0.2em] uppercase mb-6">Horaires d&apos;ouverture</h2>
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
            <p className="text-[#5a5550] text-xs mt-4">
              Horaires susceptibles de varier selon les événements.
            </p>
          </div>
        </div>
      </div>

      {/* Google Maps */}
      <section className="h-[400px] w-full bg-[#0a0a0a]">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2629.5!2d2.5186!3d48.7697!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47e60b1f3e3c5c7d%3A0x0!2s4+Place+du+Village%2C+94370+Sucy-en-Brie!5e0!3m2!1sfr!2sfr!4v1"
          width="100%"
          height="100%"
          style={{ border: 0, filter: "invert(90%) hue-rotate(180deg) saturate(0.3) brightness(0.8)" }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Le 5 - 4 place du village, Sucy-en-Brie"
        />
      </section>
    </div></WebsiteLayout>
  );
}
