/**
 * JSON-LD structured data pour Le 5 — Restaurant + LocalBusiness.
 * Aide Google/DuckDuckGo à comprendre que le site est un restaurant
 * (rich snippet : note moyenne, horaires, adresse, etc.)
 */

const SITE_URL = "https://le-5.vercel.app";

const restaurantSchema = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "@id": `${SITE_URL}/#restaurant`,
  name: "Le 5",
  alternateName: "Le 5 — Bar · Tapas · Brasserie",
  description:
    "Bar, tapas et brasserie au coeur de Sucy-en-Brie, sur la place du village. Cuisine maison, cocktails signatures, terrasse 52 places, salle 70 couverts.",
  url: SITE_URL,
  telephone: "+33983944600",
  servesCuisine: ["Brasserie", "Française", "Tapas", "Cocktails"],
  priceRange: "€€",
  acceptsReservations: "True",
  image: [
    `${SITE_URL}/images/place-le5-soir.webp`,
    `${SITE_URL}/images/terrasse-tables-soir.webp`,
    `${SITE_URL}/images/bar.webp`,
  ],
  hasMenu: `${SITE_URL}/la-carte`,
  address: {
    "@type": "PostalAddress",
    streetAddress: "4, place du village",
    addressLocality: "Sucy-en-Brie",
    postalCode: "94370",
    addressRegion: "Île-de-France",
    addressCountry: "FR",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 48.7705271,
    longitude: 2.5220481,
  },
  openingHoursSpecification: [
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Tuesday", opens: "07:00", closes: "22:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Wednesday", opens: "07:00", closes: "22:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Thursday", opens: "07:00", closes: "00:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Friday", opens: "07:00", closes: "02:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "07:00", closes: "02:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: "07:00", closes: "15:00" },
  ],
  sameAs: [
    "https://www.instagram.com/le_5_sucy",
    "https://www.facebook.com/profile.php?id=676862645517185",
  ],
};

export default function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantSchema) }}
    />
  );
}
