"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Liens vérifiés le 28/07/2026.
// Le Place ID a été dérivé du ftid de la fiche Maps (0x47e60bb763d62f43:0x14d09ffaf314fabd)
// puis validé par aller-retour : place_id → « LE 5 », 48.7705271 / 2.5220481 (Sucy-en-Brie).
const LINKS = {
  google: "https://search.google.com/local/writereview?placeid=ChIJQy_WY7cL5kcRvfoU8_qf0BQ",
  instagram: "https://www.instagram.com/le_5_sucy",
  facebook: "https://www.facebook.com/profile.php?id=61577781249436",
};

type Step = "loading" | "form" | "drawing" | "win" | "lose" | "cooldown" | "not_found";

interface PlayResult {
  status: string;
  first_name: string;
  prize?: string | null;
  prize_label?: string | null;
  is_alcohol?: boolean;
  expires_at?: string | null;
  next_play_at?: string | null;
}

const REEL = ["☕", "🍷", "🍺", "🧀", "🍸", "🎉"];

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
}

/**
 * Dispersion pseudo-aléatoire mais DÉTERMINISTE, dérivée de l'index.
 * Math.random() serait impur pendant le rendu (et donnerait un rendu serveur
 * différent du rendu client) ; le générer dans un effet déclenche un rendu en
 * cascade. Un hash sinusoïdal donne le même désordre visuel, sans les deux défauts.
 */
function scatter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  left: scatter(i, 1) * 100,
  delay: scatter(i, 2) * 0.5,
  duration: 2.4 + scatter(i, 3) * 1.6,
  rotate: scatter(i, 4) * 720 - 360,
  color: ["#f0c674", "#ef8354", "#e8536f", "#7fd1b9", "#fff7ed"][i % 5],
  size: 6 + scatter(i, 5) * 7,
}));

/** Confettis maison — aucune librairie à installer pour trois divs animées. */
function Confetti() {
  const pieces = CONFETTI;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block rounded-[2px]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            backgroundColor: p.color,
          }}
          initial={{ y: -40, opacity: 0, rotate: 0 }}
          animate={{ y: "110vh", opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

function SocialButtons({ compact = false }: { compact?: boolean }) {
  const base =
    "flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 font-medium text-[#fff7ed] backdrop-blur transition active:scale-[0.98] hover:bg-white/20";
  const size = compact ? "px-3 py-2.5 text-[13px]" : "px-4 py-3 text-sm";
  return (
    <div className="grid grid-cols-3 gap-2">
      <a href={LINKS.google} target="_blank" rel="noopener noreferrer" className={`${base} ${size}`}>
        <span aria-hidden="true">⭐</span> Avis
      </a>
      <a href={LINKS.instagram} target="_blank" rel="noopener noreferrer" className={`${base} ${size}`}>
        <span aria-hidden="true">📷</span> Insta
      </a>
      <a href={LINKS.facebook} target="_blank" rel="noopener noreferrer" className={`${base} ${size}`}>
        <span aria-hidden="true">👍</span> Facebook
      </a>
    </div>
  );
}

export default function JeuPage() {
  const params = useParams();
  const slug = params.restaurant as string;

  const [step, setStep] = useState<Step>("loading");
  const [restaurantName, setRestaurantName] = useState("Le 5");
  const [result, setResult] = useState<PlayResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [reelIndex, setReelIndex] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/lottery/public/info?slug=${slug}`);
        if (!res.ok) {
          setStep("not_found");
          return;
        }
        const data = await res.json();
        setRestaurantName(data.name || "Le 5");
        setStep("form");
      } catch {
        setStep("not_found");
      }
    }
    load();
  }, [slug]);

  // Défilement des symboles pendant le tirage
  useEffect(() => {
    if (step !== "drawing") return;
    const timer = setInterval(() => setReelIndex((i) => i + 1), 110);
    return () => clearInterval(timer);
  }, [step]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!firstName.trim()) {
      setErrorMsg("Merci d'indiquer votre prénom.");
      return;
    }
    const cleanPhone = phone.replace(/[\s.\-()]/g, "");
    if (!/^0[67]\d{8}$/.test(cleanPhone)) {
      setErrorMsg("Numéro de mobile invalide — il doit commencer par 06 ou 07 et contenir 10 chiffres.");
      return;
    }
    if (!rulesAccepted) {
      setErrorMsg("Vous devez accepter le règlement du jeu pour participer.");
      return;
    }

    setStep("drawing");
    const startedAt = Date.now();

    try {
      const res = await fetch(`${API_URL}/lottery/public/play?slug=${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          phone: cleanPhone,
          rules_accepted: rulesAccepted,
          marketing_opt_in: marketingOptIn,
          website,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErrorMsg(body?.detail || "Une erreur est survenue. Réessayez dans un instant.");
        setStep("form");
        return;
      }

      const data: PlayResult = await res.json();

      // On laisse l'animation vivre au moins 2,2 s même si l'API répond en 200 ms :
      // c'est la seconde où le client est le plus réceptif, on ne la sacrifie pas.
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, 2200 - elapsed);
      setTimeout(() => {
        setResult(data);
        if (data.status === "cooldown") setStep("cooldown");
        else if (data.status === "win") setStep("win");
        else setStep("lose");
      }, wait);
    } catch {
      setErrorMsg("Connexion impossible. Vérifiez votre réseau et réessayez.");
      setStep("form");
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#2d1b3d]">
      {/* Fond dégradé chaleureux — volontairement à l'opposé de la sobriété du back-office */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(165deg, #2d1b3d 0%, #5b2149 35%, #a3341f 70%, #d97b23 100%)",
        }}
      />
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#f0c674]/20 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-[#e8536f]/20 blur-3xl" />

      {step === "win" && <Confetti />}

      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-5 py-8">
        <AnimatePresence mode="wait">
          {/* ───────── Chargement ───────── */}
          {step === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-sm text-[#fff7ed]/70"
            >
              Un instant…
            </motion.div>
          )}

          {/* ───────── Restaurant inconnu ───────── */}
          {step === "not_found" && (
            <motion.div
              key="not_found"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-3xl border border-white/15 bg-white/10 p-6 text-center backdrop-blur-xl"
            >
              <p className="text-[#fff7ed]">{"Ce jeu n'est pas disponible."}</p>
            </motion.div>
          )}

          {/* ───────── Formulaire ───────── */}
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45 }}
            >
              <div className="mb-6 text-center">
                <p className="text-[11px] uppercase tracking-[0.35em] text-[#f0c674]">
                  {restaurantName}
                </p>
                <h1 className="mt-3 font-serif text-4xl leading-tight text-[#fff7ed]">
                  La Chance du 5
                </h1>
                <p className="mt-2 text-sm text-[#fff7ed]/75">
                  1 chance sur 3 de repartir avec quelque chose 🎉
                </p>
              </div>

              {/* Bloc réseaux — indépendant du jeu, aucune contrepartie, aucun blocage */}
              <div className="mb-5">
                <p className="mb-2 text-center text-[11px] uppercase tracking-[0.2em] text-[#fff7ed]/50">
                  Restons en contact
                </p>
                <SocialButtons />
              </div>

              <div className="mb-5 h-px bg-white/15" />

              {/* Bloc jeu */}
              <form
                onSubmit={handleSubmit}
                className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl"
              >
                <p className="mb-4 text-center text-base font-semibold text-[#fff7ed]">
                  🎲 Tentez votre chance
                </p>

                <label className="mb-1 block text-xs text-[#fff7ed]/70" htmlFor="prenom">
                  Votre prénom
                </label>
                <input
                  id="prenom"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={60}
                  autoComplete="given-name"
                  placeholder="Camille"
                  className="mb-4 w-full rounded-xl border border-white/20 bg-black/25 px-4 py-3 text-[#fff7ed] placeholder-[#fff7ed]/35 outline-none transition focus:border-[#f0c674]"
                />

                <label className="mb-1 block text-xs text-[#fff7ed]/70" htmlFor="tel">
                  Votre mobile
                </label>
                <input
                  id="tel"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                  autoComplete="tel"
                  placeholder="06 12 34 56 78"
                  className="mb-4 w-full rounded-xl border border-white/20 bg-black/25 px-4 py-3 text-[#fff7ed] placeholder-[#fff7ed]/35 outline-none transition focus:border-[#f0c674]"
                />

                {/* Honeypot — invisible pour un humain, rempli par les bots */}
                <input
                  type="text"
                  name="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute left-[-9999px] h-0 w-0 opacity-0"
                />

                <label className="mb-3 flex cursor-pointer items-start gap-3 text-[13px] leading-snug text-[#fff7ed]/90">
                  <input
                    type="checkbox"
                    checked={rulesAccepted}
                    onChange={(e) => setRulesAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#f0c674]"
                  />
                  <span>
                    {"J'ai lu et j'accepte le "}
                    <Link
                      href={`/${slug}/jeu/reglement`}
                      className="underline underline-offset-2 hover:text-[#f0c674]"
                    >
                      règlement du jeu
                    </Link>
                  </span>
                </label>

                <label className="mb-4 flex cursor-pointer items-start gap-3 text-[13px] leading-snug text-[#fff7ed]/90">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#f0c674]"
                  />
                  <span>Je veux recevoir les infos du 5 par SMS</span>
                </label>

                {errorMsg && (
                  <div className="mb-3 rounded-xl border border-red-300/40 bg-red-500/20 px-3 py-2 text-[13px] text-red-100">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-[#f0c674] to-[#ef8354] px-4 py-3.5 text-base font-bold text-[#2d1b3d] shadow-lg shadow-black/20 transition active:scale-[0.98] hover:brightness-105"
                >
                  Je joue
                </button>

                <p className="mt-3 text-center text-[11px] leading-relaxed text-[#fff7ed]/45">
                  Jeu gratuit sans obligation d&apos;achat, réservé aux personnes majeures.
                  <br />1 participation par numéro tous les 7 jours.
                </p>
              </form>
            </motion.div>
          )}

          {/* ───────── Tirage en cours ───────── */}
          {step === "drawing" && (
            <motion.div
              key="drawing"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="text-center"
            >
              <motion.div
                className="mx-auto flex h-40 w-40 items-center justify-center rounded-3xl border border-white/20 bg-white/10 text-7xl backdrop-blur-xl"
                animate={{ rotate: [0, -4, 4, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                {REEL[reelIndex % REEL.length]}
              </motion.div>
              <p className="mt-6 font-serif text-2xl text-[#fff7ed]">Tirage en cours…</p>
              <p className="mt-1 text-sm text-[#fff7ed]/60">Croisez les doigts</p>
            </motion.div>
          )}

          {/* ───────── Gagné ───────── */}
          {step === "win" && result && (
            <motion.div
              key="win"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 16 }}
              className="rounded-3xl border border-white/20 bg-white/10 p-6 text-center backdrop-blur-xl"
            >
              <div className="text-6xl">🎉</div>
              <p className="mt-3 text-sm text-[#fff7ed]/75">
                Bravo {result.first_name} !
              </p>
              <h2 className="mt-1 font-serif text-3xl leading-tight text-[#f0c674]">
                {result.prize_label}
              </h2>

              <div className="mt-5 rounded-2xl border border-white/15 bg-black/20 p-4 text-left">
                <p className="text-sm leading-relaxed text-[#fff7ed]/90">
                  Lors de votre prochaine visite, donnez simplement{" "}
                  <strong className="text-[#fff7ed]">votre prénom et votre numéro</strong> au
                  serveur — on s&apos;occupe du reste.
                </p>
                <p className="mt-2 text-[13px] text-[#fff7ed]/60">
                  Valable jusqu&apos;au {formatDate(result.expires_at)}.
                </p>
              </div>

              {result.is_alcohol && (
                <p className="mt-3 text-[11px] leading-relaxed text-[#fff7ed]/55">
                  L&apos;abus d&apos;alcool est dangereux pour la santé. À consommer avec
                  modération. Lot réservé aux personnes majeures — remplacé par un équivalent
                  sans alcool le cas échéant.
                </p>
              )}

              <div className="mt-6">
                <SocialButtons compact />
              </div>
            </motion.div>
          )}

          {/* ───────── Perdu ───────── */}
          {step === "lose" && result && (
            <motion.div
              key="lose"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-white/15 bg-white/10 p-6 text-center backdrop-blur-xl"
            >
              <div className="text-5xl">🍀</div>
              <h2 className="mt-3 font-serif text-2xl text-[#fff7ed]">
                Pas cette fois, {result.first_name}
              </h2>
              <p className="mt-2 text-sm text-[#fff7ed]/70">
                Retentez votre chance à votre prochaine visite — 1 sur 3, ça finit par tomber.
              </p>
              <div className="mt-6">
                <SocialButtons compact />
              </div>
            </motion.div>
          )}

          {/* ───────── Déjà joué cette semaine ───────── */}
          {step === "cooldown" && result && (
            <motion.div
              key="cooldown"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-white/15 bg-white/10 p-6 text-center backdrop-blur-xl"
            >
              <div className="text-5xl">⏳</div>
              <h2 className="mt-3 font-serif text-2xl text-[#fff7ed]">
                Vous avez déjà tenté votre chance cette semaine
              </h2>
              <p className="mt-2 text-sm text-[#fff7ed]/70">
                Rendez-vous à partir du {formatDate(result.next_play_at)} !
              </p>
              <div className="mt-6">
                <SocialButtons compact />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
