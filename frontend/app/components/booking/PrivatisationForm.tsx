"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const CONTACT_EMAIL = "glghospitalitypro@gmail.com";

const eventTypes = [
  "Anniversaire",
  "Repas pro / séminaire",
  "Cocktail / pot de départ",
  "Mariage / célébration",
  "Autre",
];

/**
 * Formulaire Privatisation — pas de backend.
 * À la soumission, on construit un mailto: avec subject + body pré-remplis.
 * Le visiteur valide l'envoi dans son client mail.
 */
export default function PrivatisationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventType, setEventType] = useState(eventTypes[0]);
  const [guestCount, setGuestCount] = useState<number>(20);
  const [eventDate, setEventDate] = useState("");
  const [message, setMessage] = useState("");

  const minDate = new Date().toISOString().split("T")[0];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    const subject = `[Le 5] Demande privatisation — ${name || "?"}`;
    const lines = [
      `Bonjour,`,
      ``,
      `Je souhaiterais privatiser le restaurant Le 5 pour l'événement suivant :`,
      ``,
      `• Nom : ${name}`,
      `• Téléphone : ${phone || "—"}`,
      `• Type d'événement : ${eventType}`,
      `• Convives estimés : ${guestCount}`,
      `• Date souhaitée : ${eventDate || "à définir"}`,
      ``,
      `Détails :`,
      message || "—",
      ``,
      `Merci d'avance pour votre retour.`,
    ];
    const body = lines.join("\n");

    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p className="text-sm text-[#8a8072] mb-6 leading-relaxed">
        Anniversaire, séminaire, pot de départ ou grande tablée — remplissez les détails,
        on vous répond dans la journée. Vous pouvez aussi nous appeler directement au{" "}
        <a href="tel:0983944600" className="text-[#c9a96e] hover:underline">
          09 83 94 46 00
        </a>
        .
      </p>

      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-[#b0a899] mb-1.5">Nom *</label>
            <input
              required
              placeholder="Jean Dupont"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e8e0d4] placeholder-[#5a5550] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#b0a899] mb-1.5">Téléphone</label>
            <input
              type="tel"
              placeholder="06 12 34 56 78"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e8e0d4] placeholder-[#5a5550] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#b0a899] mb-1.5">
            Votre email *
          </label>
          <input
            type="email"
            required
            placeholder="jean@exemple.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e8e0d4] placeholder-[#5a5550] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50"
          />
          <p className="text-[11px] text-[#5a5550] mt-1.5">
            On répondra à cette adresse.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#b0a899] mb-2">
            Type d&apos;événement
          </label>
          <div className="flex flex-wrap gap-2">
            {eventTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setEventType(t)}
                className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-all ${
                  eventType === t
                    ? "border-[#c9a96e] bg-[#c9a96e] text-[#111111]"
                    : "border-[#2a2a2a] bg-[#1a1a1a] text-[#b0a899] hover:border-[#3a3a3a]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-[#b0a899] mb-1.5">Date souhaitée</label>
            <input
              type="date"
              min={minDate}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e8e0d4] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#b0a899] mb-1.5">Convives estimés</label>
            <input
              type="number"
              min={2}
              max={300}
              value={guestCount}
              onChange={(e) => setGuestCount(parseInt(e.target.value) || 2)}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e8e0d4] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#b0a899] mb-1.5">Détails</label>
          <textarea
            placeholder="Ambiance souhaitée (cocktail, dîner assis, brunch...), précisions, questions."
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e8e0d4] placeholder-[#5a5550] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50 resize-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-[#c9a96e] py-3.5 text-sm font-semibold text-[#111111] hover:bg-[#d4b87d] transition-colors"
        >
          Envoyer la demande
        </button>

        <p className="text-center text-xs text-[#5a5550] leading-relaxed">
          Le bouton ouvrira votre application mail avec un message pré-rempli. Vérifiez et envoyez.
        </p>
      </form>
    </motion.div>
  );
}
