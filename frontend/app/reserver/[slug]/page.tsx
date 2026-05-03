"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import WebsiteLayout from "../../components/WebsiteLayout";
import PrivatisationForm from "../../components/booking/PrivatisationForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Step = "loading" | "form" | "sending" | "success" | "error" | "not_found";
type Mode = "classique" | "privatisation";

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
  const search = useSearchParams();
  const slug = params.slug as string;
  const initialMode: Mode = search.get("mode") === "privatisation" ? "privatisation" : "classique";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("loading");
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [date, setDate] = useState("");
  const [serviceIndex, setServiceIndex] = useState(0);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

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
        if (data.service_hours?.services?.length) {
          const services = data.service_hours.services;
          const defaultIdx = services.length - 1;
          setServiceIndex(defaultIdx);
          const interval = data.service_hours.slot_interval_minutes || 15;
          const slots = generateSlots(services[defaultIdx].start, services[defaultIdx].end, interval);
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

  const minDate = useMemo(() => new Date().toISOString().split("T")[0], []);
  const services = restaurant?.service_hours?.services || [];
  const interval = restaurant?.service_hours?.slot_interval_minutes || 15;
  const currentService = services[serviceIndex];
  const slots = currentService ? generateSlots(currentService.start, currentService.end, interval) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !date || !phone.trim()) {
      setErrorMsg("Prénom, téléphone et date sont obligatoires.");
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

  if (step === "loading") {
    return (
      <WebsiteLayout>
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-[#c9a96e]" />
        </div>
      </WebsiteLayout>
    );
  }

  if (step === "not_found") {
    return (
      <WebsiteLayout>
        <div className="flex min-h-[80vh] items-center justify-center px-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-[#e8e0d4]">Restaurant introuvable</h2>
            <p className="mt-2 text-sm text-[#8a8072]">Ce lien de réservation n&apos;est pas valide.</p>
          </div>
        </div>
      </WebsiteLayout>
    );
  }

  const restName = restaurant?.name || "Le 5";

  if (step === "success") {
    return (
      <WebsiteLayout>
        <div className="flex min-h-[80vh] items-center justify-center px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md text-center"
          >
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#c9a96e]/20">
              <svg className="h-8 w-8 text-[#c9a96e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-serif text-3xl text-[#e8e0d4] mb-3">Réservation confirmée</h2>
            <p className="text-[#8a8072] leading-relaxed">
              Votre table est réservée. Vous allez recevoir un SMS de confirmation.
              <br />À très vite au 5 !
            </p>
            <div className="mt-8 rounded-xl bg-gradient-to-br from-[#161412] to-[#0f0e0c] p-6 text-left border border-[#1f1c18]">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#5a5550] text-xs tracking-[0.2em] uppercase mb-1">Nom</p>
                  <p className="font-medium text-[#e8e0d4]">{firstName} {lastName}</p>
                </div>
                <div>
                  <p className="text-[#5a5550] text-xs tracking-[0.2em] uppercase mb-1">Couverts</p>
                  <p className="font-medium text-[#e8e0d4]">{guestCount} {guestCount > 1 ? "pers." : "pers."}</p>
                </div>
                <div>
                  <p className="text-[#5a5550] text-xs tracking-[0.2em] uppercase mb-1">Date</p>
                  <p className="font-medium text-[#e8e0d4]">
                    {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
                <div>
                  <p className="text-[#5a5550] text-xs tracking-[0.2em] uppercase mb-1">Heure</p>
                  <p className="font-medium text-[#e8e0d4]">{time}</p>
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
              className="mt-6 text-sm text-[#8a8072] underline underline-offset-2 hover:text-[#c9a96e] transition-colors"
            >
              Faire une autre réservation
            </button>
          </motion.div>
        </div>
      </WebsiteLayout>
    );
  }

  return (
    <WebsiteLayout>
      {/* Hero compact */}
      <section className="relative h-[35vh] min-h-[260px] flex items-end overflow-hidden">
        <Image
          src="/images/terrasse-tables-soir.webp"
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
            {restName}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="font-serif text-3xl md:text-5xl text-white leading-tight"
          >
            {mode === "classique" ? "Réservez votre table" : "Privatisez le 5"}
          </motion.h1>
        </div>
      </section>

      <div className="mx-auto w-full max-w-xl px-5 py-10 md:py-14">
        {/* Toggle */}
        <div className="grid grid-cols-2 rounded-lg border border-[#1f1c18] bg-[#0f0e0c] p-1 mb-8">
          {(["classique", "privatisation"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`relative py-2.5 text-xs font-semibold tracking-[0.15em] uppercase rounded-md transition-colors ${
                mode === m ? "text-[#111111]" : "text-[#8a8072] hover:text-[#cfc7b9]"
              }`}
            >
              {mode === m && (
                <motion.div
                  layoutId="modeToggle"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-0 bg-[#c9a96e] rounded-md"
                />
              )}
              <span className="relative z-10">
                {m === "classique" ? "Réserver une table" : "Privatisation"}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {mode === "classique" ? (
            <motion.div
              key="classique"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-sm text-[#8a8072] mb-6">
                Confirmation immédiate par SMS. Pour les groupes de plus de 12 personnes,
                préférez l&apos;onglet privatisation.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {(errorMsg || step === "error") && (
                  <div className="rounded-lg bg-red-900/30 border border-red-800/50 px-4 py-3 text-sm text-red-300">
                    {errorMsg || "Une erreur est survenue."}
                  </div>
                )}

                {/* Convives */}
                <div>
                  <label className="block text-sm font-medium text-[#b0a899] mb-2">Nombre de convives</label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setGuestCount(n)}
                        className={`h-10 w-10 rounded-lg border text-sm font-medium transition-all ${
                          guestCount === n
                            ? "border-[#c9a96e] bg-[#c9a96e] text-[#111111]"
                            : "border-[#2a2a2a] bg-[#1a1a1a] text-[#b0a899] hover:border-[#3a3a3a]"
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
                          ? "border-[#c9a96e] bg-[#c9a96e] text-[#111111]"
                          : "border-[#2a2a2a] bg-[#1a1a1a] text-[#b0a899] hover:border-[#3a3a3a]"
                      }`}
                    >
                      9+
                    </button>
                  </div>
                  {guestCount > 12 && (
                    <p className="mt-2 text-xs text-[#c9a96e]">
                      💡 Plus de 12 personnes ? L&apos;onglet privatisation est mieux adapté.
                    </p>
                  )}
                  {guestCount > 8 && (
                    <input
                      type="number"
                      min={9}
                      max={30}
                      value={guestCount}
                      onChange={(e) => setGuestCount(Math.max(9, parseInt(e.target.value) || 9))}
                      className="mt-2 w-24 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-[#e8e0d4] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50"
                    />
                  )}
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-[#b0a899] mb-2">Date</label>
                  <input
                    type="date"
                    required
                    min={minDate}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e8e0d4] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50"
                  />
                </div>

                {services.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-[#b0a899] mb-2">Service</label>
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
                              ? "border-[#c9a96e] bg-[#c9a96e] text-[#111111]"
                              : "border-[#2a2a2a] bg-[#1a1a1a] text-[#b0a899] hover:border-[#3a3a3a]"
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
                  <label className="block text-sm font-medium text-[#b0a899] mb-2">Heure</label>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTime(t)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                          time === t
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
                    <label className="block text-sm font-medium text-[#b0a899] mb-1.5">Prénom *</label>
                    <input
                      required
                      placeholder="Jean"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e8e0d4] placeholder-[#5a5550] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#b0a899] mb-1.5">Nom</label>
                    <input
                      placeholder="Dupont"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e8e0d4] placeholder-[#5a5550] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#b0a899] mb-1.5">Téléphone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="06 12 34 56 78"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e8e0d4] placeholder-[#5a5550] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#b0a899] mb-1.5">Email</label>
                  <input
                    type="email"
                    placeholder="jean@exemple.fr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e8e0d4] placeholder-[#5a5550] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#b0a899] mb-1.5">Demandes particulières</label>
                  <textarea
                    placeholder="Allergies, anniversaire, terrasse souhaitée..."
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e8e0d4] placeholder-[#5a5550] focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={step === "sending"}
                  className="w-full rounded-lg bg-[#c9a96e] py-3.5 text-sm font-semibold text-[#111111] hover:bg-[#d4b87d] transition-colors disabled:opacity-50"
                >
                  {step === "sending" ? "Envoi en cours..." : "Confirmer ma réservation"}
                </button>

                <p className="text-center text-xs text-[#5a5550] leading-relaxed">
                  Confirmation immédiate par SMS. Pour toute urgence, appelez le 09 83 94 46 00.
                </p>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="privatisation"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <PrivatisationForm />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </WebsiteLayout>
  );
}
