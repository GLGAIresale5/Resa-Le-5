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

async function subscribeToPush(): Promise<boolean> {
  try {
    // 1. Register service worker
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // 2. Get VAPID public key from backend
    const keyResponse = await fetch(`${API_URL}/push/vapid-public-key`);
    const { publicKey } = await keyResponse.json();

    if (!publicKey) {
      console.log("[Push] Pas de clé VAPID configurée");
      return false;
    }

    // 3. Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const subJson = subscription.toJSON();

    // 4. Send subscription to backend
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

    console.log("[Push] Abonnement réussi");
    return true;
  } catch (err) {
    console.error("[Push] Erreur d'abonnement:", err);
    return false;
  }
}

export default function PushNotifications() {
  const [status, setStatus] = useState<"loading" | "prompt" | "subscribed" | "denied" | "unsupported">("loading");

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "granted") {
      // Already granted — subscribe silently
      subscribeToPush().then(() => setStatus("subscribed"));
    } else if (Notification.permission === "denied") {
      setStatus("denied");
    } else {
      // Need to ask — show button (required on iOS)
      setStatus("prompt");
    }
  }, []);

  async function handleEnableNotifications() {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const ok = await subscribeToPush();
      setStatus(ok ? "subscribed" : "prompt");
    } else {
      setStatus("denied");
    }
  }

  // Show banner only when permission needs to be requested
  if (status !== "prompt") return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 mx-4 md:bottom-4 md:left-auto md:right-4 md:mx-0 md:max-w-sm">
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg">
          🔔
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-900">Notifications</p>
          <p className="text-xs text-zinc-500">Recevez une alerte à chaque nouvelle réservation</p>
        </div>
        <button
          onClick={handleEnableNotifications}
          className="shrink-0 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white active:bg-zinc-700"
        >
          Activer
        </button>
      </div>
    </div>
  );
}
