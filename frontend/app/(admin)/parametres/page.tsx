"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../lib/auth-context";

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
  const { restaurant, user, session, signOut } = useAuth();
  const RESTAURANT_ID = restaurant?.id ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pushStatus, setPushStatus] = useState<"loading" | "active" | "inactive" | "denied" | "unsupported">("loading");
  const [subscribing, setSubscribing] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);
  const [oauthFlash, setOauthFlash] = useState<string | null>(null);

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
      <h1 className="text-xl font-bold text-zinc-900">Paramètres</h1>
      <p className="mt-1 text-sm text-zinc-500">Configuration de votre espace GLG AI</p>

      {/* Notifications */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Notifications</h2>
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-base">
                🔔
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">Notifications push</p>
                <p className="text-xs text-zinc-500">
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
                  pushStatus === "active" ? "bg-green-500" : "bg-zinc-300"
                } ${subscribing ? "opacity-50" : ""}`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    pushStatus === "active" ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            )}
            {pushStatus === "denied" && (
              <span className="text-xs text-red-500 font-medium">Bloqué</span>
            )}
          </div>
        </div>
      </div>

      {/* Compte */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Compte</h2>
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-base">
                👤
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">{user?.email}</p>
                <p className="text-xs text-zinc-500">{restaurant?.name}</p>
              </div>
            </div>
            <button
              onClick={async () => { await signOut(); router.push("/login"); }}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* OAuth flash message */}
      {oauthFlash && (
        <div className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
          oauthFlash.includes("succès") ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {oauthFlash}
        </div>
      )}

      {/* Connexions */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Connexions</h2>
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
          {/* Google Business */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-base">
                G
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">Google Business</p>
                <p className="text-xs text-zinc-500">
                  {oauthStatus?.google.connected
                    ? "Connecté — les avis remontent automatiquement"
                    : "Connectez votre fiche Google pour synchroniser les avis"}
                </p>
              </div>
            </div>
            <a
              href={`${API_URL}/oauth/google/connect`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                oauthStatus?.google.connected
                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              {oauthStatus?.google.connected ? "Reconnecter" : "Connecter"}
            </a>
          </div>

          {/* Meta / Instagram */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-50 text-base">
                IG
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">Instagram & Facebook</p>
                <p className="text-xs text-zinc-500">
                  {oauthStatus?.meta.connected
                    ? "Connecté — publication automatique disponible"
                    : "Connectez Instagram pour publier depuis l'app"}
                </p>
              </div>
            </div>
            <a
              href={`${API_URL}/oauth/meta/connect`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                oauthStatus?.meta.connected
                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                  : "border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100"
              }`}
            >
              {oauthStatus?.meta.connected ? "Reconnecter" : "Connecter"}
            </a>
          </div>

          {/* SMS */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-base">
                SMS
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">SMS de confirmation</p>
                <p className="text-xs text-zinc-500">
                  {oauthStatus?.sms.enabled
                    ? `Actif — expéditeur : ${oauthStatus.sms.sender_name || "Restaurant"}`
                    : "Désactivé"}
                </p>
              </div>
            </div>
            <span className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              oauthStatus?.sms.enabled
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-zinc-200 bg-zinc-50 text-zinc-500"
            }`}>
              {oauthStatus?.sms.enabled ? "Actif" : "Inactif"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
