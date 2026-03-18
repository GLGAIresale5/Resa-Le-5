"use client";

import { useState, useMemo } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "60945098-cb17-4b47-8771-4b0110ec6d9d";

// Service: 12h-14h30 (déjeuner) & 19h-22h30 (dîner)
const LUNCH_SLOTS = ["12:00", "12:15", "12:30", "12:45", "13:00", "13:15", "13:30", "13:45", "14:00"];
const DINNER_SLOTS = [
  "19:00", "19:15", "19:30", "19:45",
  "20:00", "20:15", "20:30", "20:45",
  "21:00", "21:15", "21:30", "21:45",
  "22:00",
];

type Step = "form" | "sending" | "success" | "error";

export default function ReserverPage() {
  const [step, setStep] = useState<Step>("form");
  const [errorMsg, setErrorMsg] = useState("");

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [date, setDate] = useState("");
  const [service, setService] = useState<"lunch" | "dinner">("dinner");
  const [time, setTime] = useState("20:00");
  const [notes, setNotes] = useState("");

  // Minimum date = today
  const minDate = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  const slots = service === "lunch" ? LUNCH_SLOTS : DINNER_SLOTS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim()) return;
    if (!date) return;
    if (!phone.trim()) {
      setErrorMsg("Le numéro de téléphone est obligatoire.");
      return;
    }

    setStep("sending");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/reservations/public/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_first_name: firstName.trim(),
          guest_last_name: lastName.trim(),
          guest_email: email.trim() || null,
          guest_phone: phone.trim() || null,
          guest_count: guestCount,
          date,
          time,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Une erreur est survenue.");
      }

      setStep("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStep("error");
    }
  };

  // ─── Success screen ───
  if (step === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-stone-900">Demande envoyée !</h2>
          <p className="mt-3 text-stone-600 leading-relaxed">
            Votre demande de réservation a bien été reçue.<br />
            Nous vous confirmerons votre table par {email ? "email" : "téléphone"} dans les plus brefs délais.
          </p>
          <div className="mt-8 rounded-xl bg-white p-5 text-left shadow-sm border border-stone-200">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-stone-400">Nom</p>
                <p className="font-medium text-stone-800">{firstName} {lastName}</p>
              </div>
              <div>
                <p className="text-stone-400">Couverts</p>
                <p className="font-medium text-stone-800">{guestCount} {guestCount > 1 ? "personnes" : "personne"}</p>
              </div>
              <div>
                <p className="text-stone-400">Date</p>
                <p className="font-medium text-stone-800">
                  {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              </div>
              <div>
                <p className="text-stone-400">Heure</p>
                <p className="font-medium text-stone-800">{time}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setStep("form");
              setFirstName("");
              setLastName("");
              setEmail("");
              setPhone("");
              setGuestCount(2);
              setDate("");
              setTime("20:00");
              setService("dinner");
              setNotes("");
            }}
            className="mt-6 text-sm text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
          >
            Faire une autre réservation
          </button>
        </div>
      </div>
    );
  }

  // ─── Form ───
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold text-stone-900 tracking-tight">Le 5</h1>
            <p className="text-xs text-stone-400">5 rue du Général Clergerie, Paris 16e</p>
          </div>
          <a
            href="tel:+33145530068"
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Appeler
          </a>
        </div>
      </header>

      {/* Form */}
      <main className="mx-auto w-full max-w-lg flex-1 px-5 py-6">
        <h2 className="text-xl font-semibold text-stone-900">Réserver une table</h2>
        <p className="mt-1 text-sm text-stone-500">
          Votre réservation sera confirmée par notre équipe.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          {/* Error */}
          {(errorMsg || step === "error") && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMsg || "Une erreur est survenue. Veuillez réessayer."}
            </div>
          )}

          {/* Guest count */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Nombre de convives
            </label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGuestCount(n)}
                  className={`h-10 w-10 rounded-lg border text-sm font-medium transition-all ${
                    guestCount === n
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setGuestCount(guestCount > 8 ? guestCount : 9)}
                className={`h-10 rounded-lg border px-3 text-sm font-medium transition-all ${
                  guestCount > 8
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
                }`}
              >
                9+
              </button>
            </div>
            {guestCount > 8 && (
              <input
                type="number"
                min={9}
                max={30}
                value={guestCount}
                onChange={(e) => setGuestCount(Math.max(9, parseInt(e.target.value) || 9))}
                className="mt-2 w-24 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Date</label>
            <input
              type="date"
              required
              min={minDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
          </div>

          {/* Service toggle */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Service</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setService("lunch"); setTime("12:30"); }}
                className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-all ${
                  service === "lunch"
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
                }`}
              >
                Déjeuner
              </button>
              <button
                type="button"
                onClick={() => { setService("dinner"); setTime("20:00"); }}
                className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-all ${
                  service === "dinner"
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
                }`}
              >
                Dîner
              </button>
            </div>
          </div>

          {/* Time slots */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Heure</label>
            <div className="flex flex-wrap gap-2">
              {slots.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    time === t
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Prénom *</label>
              <input
                required
                placeholder="Jean"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Nom</label>
              <input
                placeholder="Dupont"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
          </div>

          {/* Contact */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Téléphone *</label>
            <input
              type="tel"
              required
              placeholder="06 12 34 56 78"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
            <input
              type="email"
              placeholder="jean@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              Demandes particulières
            </label>
            <textarea
              placeholder="Allergies, anniversaire, terrasse souhaitée..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={step === "sending"}
            className="w-full rounded-lg bg-stone-900 py-3.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            {step === "sending" ? "Envoi en cours..." : "Demander une réservation"}
          </button>

          <p className="text-center text-xs text-stone-400 leading-relaxed">
            Votre réservation sera confirmée par notre équipe.<br />
            Pour toute urgence, appelez-nous directement.
          </p>
        </form>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-4 text-center text-xs text-stone-400">
        Le 5 — 5 rue du Général Clergerie, 75116 Paris
      </footer>
    </div>
  );
}
