"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

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
  const [pushStatus, setPushStatus] = useState<"loading" | "active" | "inactive" | "denied" | "unsupported">("loading");
  const [subscribing, setSubscribing] = useState(false);

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

      {/* Placeholder for future settings */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">À venir</h2>
        <div className="mt-3 space-y-2">
          {[
            { icon: "📦", label: "Gestion des stocks", desc: "Mode tendu, équilibré, flux…" },
            { icon: "🏪", label: "Restaurant", desc: "Horaires, services, coordonnées" },
            { icon: "👤", label: "Compte", desc: "Profil, mot de passe, abonnement" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4 opacity-50">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-base">
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-600">{item.label}</p>
                <p className="text-xs text-zinc-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
