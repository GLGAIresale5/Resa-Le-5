"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";
import { fetchCharges, createCharge, deleteCharge } from "../../../lib/api";
import { ChargeFixe, ChargeCategory } from "../../../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CHARGE_CATEGORIES: { value: ChargeCategory; label: string }[] = [
  { value: "salaires", label: "Salaires" },
  { value: "loyer", label: "Loyer" },
  { value: "assurance", label: "Assurance" },
  { value: "energie", label: "Energie" },
  { value: "divers", label: "Divers" },
];

interface OAuthStatus {
  google: { connected: boolean; location: string | null };
  meta: { connected: boolean; page_id: string | null; instagram_id: string | null };
  sms: { enabled: boolean; sender_name: string | null; phone: string | null };
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function ParametresPage() {
  const { restaurant, user, session, signOut, refreshRestaurant } = useAuth();
  const RESTAURANT_ID = restaurant?.id ?? "";
  const router = useRouter();
  const params = useParams();
  const slug = params.restaurant as string;
  const searchParams = useSearchParams();
  const [pushStatus, setPushStatus] = useState<"loading" | "active" | "inactive" | "denied" | "unsupported">("loading");
  const [subscribing, setSubscribing] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);
  const [oauthFlash, setOauthFlash] = useState<string | null>(null);
  const [toneProfile, setToneProfile] = useState("");
  const [toneLoaded, setToneLoaded] = useState(false);
  const [toneSaving, setToneSaving] = useState(false);
  const [toneSaved, setToneSaved] = useState(false);

  // Charges fixes mensuelles (config compta)
  const [charges, setCharges] = useState<ChargeFixe[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newCategory, setNewCategory] = useState<ChargeCategory>("divers");

  const fmtEur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  const loadCharges = () => {
    if (!RESTAURANT_ID) return;
    fetchCharges(RESTAURANT_ID).then(setCharges).catch(() => {});
  };

  useEffect(() => {
    loadCharges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [RESTAURANT_ID]);

  const handleAddCharge = async () => {
    if (!RESTAURANT_ID || !newLabel || newAmount <= 0) return;
    try {
      await createCharge({ restaurant_id: RESTAURANT_ID, label: newLabel, amount: newAmount, category: newCategory });
      setNewLabel("");
      setNewAmount(0);
      setNewCategory("divers");
      loadCharges();
    } catch {}
  };

  const handleDeleteCharge = async (chargeId: string) => {
    if (!RESTAURANT_ID) return;
    try {
      await deleteCharge(chargeId, RESTAURANT_ID);
      loadCharges();
    } catch {}
  };

  // Load tone_profile from restaurant data
  useEffect(() => {
    if (restaurant?.tone_profile && !toneLoaded) {
      setToneProfile(restaurant.tone_profile);
      setToneLoaded(true);
    }
  }, [restaurant?.tone_profile, toneLoaded]);

  async function handleSaveToneProfile() {
    if (!session?.access_token || !RESTAURANT_ID) return;
    setToneSaving(true);
    setToneSaved(false);
    try {
      const res = await fetch(`${API_URL}/auth/tone-profile?restaurant_id=${RESTAURANT_ID}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tone_profile: toneProfile }),
      });
      if (res.ok) {
        setToneSaved(true);
        refreshRestaurant();
        setTimeout(() => setToneSaved(false), 3000);
      }
    } catch {}
    setToneSaving(false);
  }

  // Check for OAuth callback flash messages
  useEffect(() => {
    const google = searchParams.get("google");
    const meta = searchParams.get("meta");
    if (google === "success") setOauthFlash("Google Business connecté avec succès !");
    else if (google === "error") setOauthFlash("Erreur lors de la connexion Google. Réessayez.");
    else if (meta === "success") setOauthFlash("Instagram / Facebook connecté avec succès !");
    else if (meta === "error") setOauthFlash("Erreur lors de la connexion Meta. Réessayez.");
  }, [searchParams]);

  // Fetch OAuth status
  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${API_URL}/oauth/status`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setOauthStatus(data); })
      .catch(() => {});
  }, [session?.access_token]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushStatus("denied");
      return;
    }
    // Check if actively subscribed — with timeout fallback
    const timeout = setTimeout(() => setPushStatus("inactive"), 3000);
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      return reg.pushManager.getSubscription();
    }).then((sub) => {
      clearTimeout(timeout);
      setPushStatus(sub ? "active" : "inactive");
    }).catch(() => {
      clearTimeout(timeout);
      setPushStatus("inactive");
    });
  }, []);

  async function handleToggleNotifications() {
    if (pushStatus === "active") {
      // Unsubscribe
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await fetch(`${API_URL}/push/unsubscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          await subscription.unsubscribe();
        }
        setPushStatus("inactive");
      } catch (err) {
        console.error("Erreur désabonnement:", err);
      }
      return;
    }

    // Subscribe
    setSubscribing(true);
    try {
      // Check current permission — if already granted, skip the prompt
      let permission = Notification.permission;
      if (permission !== "granted") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") {
        setPushStatus("denied");
        setSubscribing(false);
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const keyResponse = await fetch(`${API_URL}/push/vapid-public-key`);
      const { publicKey } = await keyResponse.json();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const subJson = subscription.toJSON();
      await fetch(`${API_URL}/push/subscribe?restaurant_id=${RESTAURANT_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh ?? "",
          auth: subJson.keys?.auth ?? "",
          user_agent: navigator.userAgent,
        }),
      });

      setPushStatus("active");
    } catch (err) {
      console.error("Erreur abonnement:", err);
    }
    setSubscribing(false);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <h1 className="text-xl font-bold tracking-tight text-white">Paramètres</h1>
      <p className="mt-1 text-sm text-neutral-400">Configuration de votre espace GLG AI</p>

      {/* Notifications */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">Notifications</h2>
        <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/15 text-base text-blue-300">
                🔔
              </div>
              <div>
                <p className="text-sm font-medium text-white">Notifications push</p>
                <p className="text-xs text-neutral-400">
                  {pushStatus === "active"
                    ? "Vous recevez les alertes de nouvelles réservations"
                    : pushStatus === "denied"
                    ? "Notifications bloquées — allez dans Réglages > Safari pour les réactiver"
                    : pushStatus === "unsupported"
                    ? "Non disponible sur cet appareil"
                    : "Recevez une alerte à chaque nouvelle réservation"}
                </p>
              </div>
            </div>
            {pushStatus !== "unsupported" && pushStatus !== "denied" && pushStatus !== "loading" && (
              <button
                onClick={handleToggleNotifications}
                disabled={subscribing}
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  pushStatus === "active" ? "bg-emerald-500" : "bg-neutral-700"
                } ${subscribing ? "opacity-50" : ""}`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                    pushStatus === "active" ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            )}
            {pushStatus === "denied" && (
              <span className="text-xs text-red-400 font-medium">Bloqué</span>
            )}
          </div>
        </div>
      </div>

      {/* Compte */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">Compte</h2>
        <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-base">
                👤
              </div>
              <div>
                <p className="text-sm font-medium text-white">{user?.email}</p>
                <p className="text-xs text-neutral-400">{restaurant?.name}</p>
              </div>
            </div>
            <button
              onClick={async () => { await signOut(); router.push("/login"); }}
              className="rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/25"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* OAuth flash message */}
      {oauthFlash && (
        <div className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
          oauthFlash.includes("succès") ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-red-500/40 bg-red-500/15 text-red-300"
        }`}>
          {oauthFlash}
        </div>
      )}

      {/* Connexions */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">Connexions</h2>
        <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800/60">
          {/* Google Business */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/15 text-base text-blue-300">
                G
              </div>
              <div>
                <p className="text-sm font-medium text-white">Google Business</p>
                <p className="text-xs text-neutral-400">
                  {oauthStatus?.google.connected
                    ? "Connecté — les avis remontent automatiquement"
                    : "Connectez votre fiche Google pour synchroniser les avis"}
                </p>
              </div>
            </div>
            <a
              href={`${API_URL}/oauth/google/connect?token=${session?.access_token || ""}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                oauthStatus?.google.connected
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                  : "border-blue-500/30 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25"
              }`}
            >
              {oauthStatus?.google.connected ? "Reconnecter" : "Connecter"}
            </a>
          </div>

          {/* Meta / Instagram */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-500/15 text-base text-pink-300">
                IG
              </div>
              <div>
                <p className="text-sm font-medium text-white">Meta</p>
                <p className="text-xs text-neutral-400">
                  {oauthStatus?.meta.connected
                    ? "Connecté — publication automatique disponible"
                    : "Connectez Instagram pour publier depuis l'app"}
                </p>
              </div>
            </div>
            <a
              href={`${API_URL}/oauth/meta/connect?token=${session?.access_token || ""}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                oauthStatus?.meta.connected
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                  : "border-pink-500/30 bg-pink-500/15 text-pink-300 hover:bg-pink-500/25"
              }`}
            >
              {oauthStatus?.meta.connected ? "Reconnecter" : "Connecter"}
            </a>
          </div>

          {/* SMS */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-base text-emerald-300">
                SMS
              </div>
              <div>
                <p className="text-sm font-medium text-white">SMS de confirmation</p>
                <p className="text-xs text-neutral-400">
                  {oauthStatus?.sms.enabled
                    ? `Actif — expéditeur : ${oauthStatus.sms.sender_name || "Restaurant"}`
                    : "Désactivé"}
                </p>
              </div>
            </div>
            <span className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              oauthStatus?.sms.enabled
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                : "border-neutral-800 bg-neutral-900 text-neutral-400"
            }`}>
              {oauthStatus?.sms.enabled ? "Actif" : "Inactif"}
            </span>
          </div>
        </div>
      </div>

      {/* Profil éditorial */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">Profil éditorial</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Définissez le ton, les hashtags et le style de vos posts réseaux sociaux. L&apos;IA s&apos;en servira comme guide.
        </p>
        <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <textarea
            value={toneProfile}
            onChange={(e) => { setToneProfile(e.target.value); setToneSaved(false); }}
            rows={10}
            placeholder={"Ex :\nTon : pragmatique et décontracté. Phrases courtes, directes.\nInterdit : \"Laissez-vous tenter...\", \"Nous sommes ravis...\"\nHashtags fixes : #monrestaurant #maville\nExemple bon ton : \"Nos croquetas sont maison, croustillantes dehors, fondantes dedans.\""}
            className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleSaveToneProfile}
              disabled={toneSaving}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
            >
              {toneSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
            {toneSaved && (
              <span className="text-xs font-medium text-emerald-300">Enregistré</span>
            )}
          </div>
        </div>
      </div>

      {/* Charges fixes mensuelles */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">Charges fixes mensuelles</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Les charges récurrentes SANS facture à scanner (salaire, loyer). Elles sont déduites du résultat.
          N&apos;y mettez PAS ce qui arrive déjà en facture (énergie, assurance…) pour éviter le double comptage.
        </p>

        <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <div>
              <label className="block text-[10px] text-neutral-400 mb-0.5">Libelle</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ex: Salaire Joao"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-2 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-neutral-400 mb-0.5">Montant mensuel</label>
              <input
                type="number"
                step="0.01"
                value={newAmount || ""}
                onChange={(e) => setNewAmount(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-2 py-1.5 text-xs text-white focus:border-neutral-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-neutral-400 mb-0.5">Categorie</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ChargeCategory)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-2 py-1.5 text-xs text-white focus:border-neutral-500 focus:outline-none"
              >
                {CHARGE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddCharge}
              disabled={!newLabel || newAmount <= 0}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition disabled:opacity-40"
            >
              Ajouter
            </button>
          </div>
        </div>

        {charges.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {CHARGE_CATEGORIES.map((cat) => {
              const catCharges = charges.filter((c) => c.category === cat.value);
              if (catCharges.length === 0) return null;
              const catTotal = catCharges.reduce((s, c) => s + c.amount, 0);
              return (
                <div key={cat.value}>
                  <div className="flex items-center justify-between px-1 py-1.5">
                    <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">{cat.label}</span>
                    <span className="text-xs text-white font-medium">{fmtEur(catTotal)}</span>
                  </div>
                  {catCharges.map((charge) => (
                    <div key={charge.id} className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
                      <span className="flex-1 text-sm text-white">{charge.label}</span>
                      <span className="text-sm font-medium text-white">{fmtEur(charge.amount)}</span>
                      <button onClick={() => handleDeleteCharge(charge.id)} className="text-neutral-500 hover:text-red-300 transition">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-3 mt-2">
              <span className="text-sm font-medium text-white">Total charges fixes</span>
              <span className="text-lg font-semibold text-white">{fmtEur(charges.reduce((s, c) => s + c.amount, 0))}/mois</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
