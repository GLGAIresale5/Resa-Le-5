"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Step = "loading" | "form" | "sending" | "success" | "error" | "not_found";

interface ServiceSlot {
  name: string;
  start: string;
  end: string;
}

interface RestaurantInfo {
  id: string;
  name: string;
  slug: string;
  service_hours: {
    services: ServiceSlot[];
    slot_interval_minutes: number;
  } | null;
}

function generateSlots(start: string, end: string, intervalMinutes: number): string[] {
  const slots: string[] = [];
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  let current = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  // Last bookable slot is 30 min before end
  const lastSlot = endMin - 30;

  while (current <= lastSlot) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    current += intervalMinutes;
  }
  return slots;
}

export default function ReserverSlugPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [step, setStep] = useState<Step>("loading");
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [date, setDate] = useState("");
  const [serviceIndex, setServiceIndex] = useState(0);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch restaurant info
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/reservations/public/restaurant?slug=${slug}`);
        if (!res.ok) {
          setStep("not_found");
          return;
        }
        const data: RestaurantInfo = await res.json();
        setRestaurant(data);

        // Set defaults based on service hours
        if (data.service_hours?.services?.length) {
          const services = data.service_hours.services;
          // Default to last service (dinner if exists)
          const defaultIdx = services.length - 1;
          setServiceIndex(defaultIdx);
          const interval = data.service_hours.slot_interval_minutes || 15;
          const slots = generateSlots(services[defaultIdx].start, services[defaultIdx].end, interval);
          // Default to middle-ish slot
          const midIdx = Math.min(Math.floor(slots.length / 3), slots.length - 1);
          setTime(slots[midIdx] || services[defaultIdx].start);
        }

        setStep("form");
      } catch {
        setStep("not_found");
      }
    }
    load();
  }, [slug]);

  // Minimum date = today
  const minDate = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  // Compute slots from service_hours
  const services = restaurant?.service_hours?.services || [];
  const interval = restaurant?.service_hours?.slot_interval_minutes || 15;
  const currentService = services[serviceIndex];
  const slots = currentService ? generateSlots(currentService.start, currentService.end, interval) : [];

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
      const res = await fetch(`${API_URL}/reservations/public/book?slug=${slug}`, {
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

  // ─── Loading ───
  if (step === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
      </div>
    );
  }

  // ─── Not found ───
  if (step === "not_found") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-stone-900">Restaurant introuvable</h2>
          <p className="mt-2 text-sm text-stone-500">
            Ce lien de réservation n&apos;est pas valide.
          </p>
        </div>
      </div>
    );
  }

  const restName = restaurant?.name || "Restaurant";

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
              setTime(slots[Math.floor(slots.length / 3)] || "");
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
            <h1 className="text-lg font-semibold text-stone-900 tracking-tight">{restName}</h1>
          </div>
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
          {services.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Service</label>
              <div className="flex gap-2">
                {services.map((svc, idx) => (
                  <button
                    key={svc.name}
                    type="button"
                    onClick={() => {
                      setServiceIndex(idx);
                      const newSlots = generateSlots(svc.start, svc.end, interval);
                      const midIdx = Math.min(Math.floor(newSlots.length / 3), newSlots.length - 1);
                      setTime(newSlots[midIdx] || svc.start);
                    }}
                    className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-all ${
                      serviceIndex === idx
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {svc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

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
        {restName}
      </footer>
    </div>
  );
}
