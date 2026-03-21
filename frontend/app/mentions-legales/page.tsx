import type { Metadata } from "next";
import WebsiteLayout from "../components/WebsiteLayout";

export const metadata: Metadata = {
  title: "Mentions Légales",
  description: "Mentions légales du site Le 5 — GLG Hospitality SAS.",
};

export default function MentionsLegalesPage() {
  return (
    <WebsiteLayout><div className="min-h-screen px-6 py-16 md:px-12 max-w-3xl">
      <h1 className="font-serif text-4xl text-[#e8e0d4] mb-12">Mentions Légales</h1>

      <div className="space-y-10 text-[#b0a899] leading-relaxed">
        {/* Éditeur */}
        <section>
          <h2 className="text-[#c9a96e] text-sm tracking-[0.2em] uppercase mb-4">
            Éditeur du site
          </h2>
          <div className="space-y-1">
            <p><strong className="text-[#e8e0d4]">GLG Hospitality SAS</strong></p>
            <p>4, place du village — 94370 Sucy-en-Brie</p>
            <p>SIRET : à compléter</p>
            <p>RCS : à compléter</p>
            <p>N° TVA intracommunautaire : à compléter</p>
            <p>Directeur de la publication : Baptiste Gallagher</p>
            <p>Téléphone : 09 83 94 46 00</p>
            <p>Email : contact@glghospitality.com</p>
          </div>
        </section>

        {/* Hébergeur */}
        <section>
          <h2 className="text-[#c9a96e] text-sm tracking-[0.2em] uppercase mb-4">
            Hébergement
          </h2>
          <div className="space-y-1">
            <p><strong className="text-[#e8e0d4]">Vercel Inc.</strong></p>
            <p>340 S Lemon Ave #4133, Walnut, CA 91789, USA</p>
            <p>Site : vercel.com</p>
          </div>
        </section>

        {/* Propriété intellectuelle */}
        <section>
          <h2 className="text-[#c9a96e] text-sm tracking-[0.2em] uppercase mb-4">
            Propriété intellectuelle
          </h2>
          <p>
            L&apos;ensemble du contenu de ce site (textes, images, logo, photographies)
            est la propriété exclusive de GLG Hospitality SAS, sauf mention contraire.
            Toute reproduction, représentation ou diffusion, même partielle, du contenu
            de ce site est interdite sans autorisation écrite préalable.
          </p>
        </section>

        {/* Données personnelles */}
        <section>
          <h2 className="text-[#c9a96e] text-sm tracking-[0.2em] uppercase mb-4">
            Données personnelles
          </h2>
          <p>
            Les informations recueillies lors d&apos;une réservation (nom, téléphone, email)
            sont utilisées uniquement pour la gestion de votre réservation. Elles ne sont
            ni vendues ni transmises à des tiers. Conformément au RGPD, vous disposez d&apos;un
            droit d&apos;accès, de modification et de suppression de vos données en contactant
            contact@glghospitality.com.
          </p>
        </section>

        {/* Cookies */}
        <section>
          <h2 className="text-[#c9a96e] text-sm tracking-[0.2em] uppercase mb-4">
            Cookies
          </h2>
          <p>
            Ce site n&apos;utilise pas de cookies de traçage publicitaire. Seuls des cookies
            techniques nécessaires au fonctionnement du site peuvent être utilisés.
          </p>
        </section>

        {/* Crédits */}
        <section>
          <h2 className="text-[#c9a96e] text-sm tracking-[0.2em] uppercase mb-4">
            Crédits
          </h2>
          <p>
            Conception et développement : GLG AI<br />
            Photographies : Le 5
          </p>
        </section>
      </div>
    </div></WebsiteLayout>
  );
}
