"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  const searchParams = useSearchParams();
  const [pushStatus, setPushStatus] = useState<"loading" | "active" | "inactive" | "denied" | "unsupported">("loading");
  const [subscribing, setSubscribing] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);
  const [toneDraft, setToneDraft] = useState("");
  const [toneEdited, setToneEdited] = useState(false);
  const [toneSaving, setToneSaving] = useState(false);
  const [toneSaved, setToneSaved] = useState(false);

  // Valeur affichée : le brouillon dès que l'utilisateur a tapé, sinon le profil serveur.
  const toneProfile = toneEdited ? toneDraft : restaurant?.tone_profile ?? "";

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

  // OAuth callback flash message — dérivé des query params du redirect
  const oauthFlash = useMemo(() => {
    const google = searchParams.get("google");
    const meta = searchParams.get("meta");
    if (google === "success") return "Google Business connecté avec succès !";
    if (google === "error") return "Erreur lors de la connexion Google. Réessayez.";
    if (meta === "success") return "Instagram / Facebook connecté avec succès !";
    if (meta === "error") return "Erreur lors de la connexion Meta. Réessayez.";
    return null;
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
    // Détection du support + de l'abonnement push, avec fallback 3 s.
    let cancelled = false;
    const finish = (status: "active" | "inactive" | "denied" | "unsupported") => {
      if (!cancelled) setPushStatus(status);
    };
    const timeout = setTimeout(() => finish("inactive"), 3000);
    Promise.resolve()
      .then(async () => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported" as const;
        if (Notification.permission === "denied") return "denied" as const;
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        return sub ? ("active" as const) : ("inactive" as const);
      })
      .catch(() => "inactive" as const)
      .then((status) => {
        clearTimeout(timeout);
        finish(status);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
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
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token ?? ""}`,
            },
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
    if (!session?.access_token || !RESTAURANT_ID) return;
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
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
            onChange={(e) => { setToneDraft(e.target.value); setToneEdited(true); setToneSaved(false); }}
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

    </div>
  );
}
