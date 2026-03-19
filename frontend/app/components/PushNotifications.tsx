"use client";

import { useEffect } from "react";

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

async function subscribeToPush() {
  try {
    // 1. Register service worker
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // 2. Get VAPID public key from backend
    const keyResponse = await fetch(`${API_URL}/push/vapid-public-key`);
    const { publicKey } = await keyResponse.json();

    if (!publicKey) {
      console.log("[Push] Pas de clé VAPID configurée");
      return;
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
  } catch (err) {
    console.error("[Push] Erreur d'abonnement:", err);
  }
}

export default function PushNotifications() {
  useEffect(() => {
    // Only run in browser with service worker support
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    // Request notification permission, then subscribe
    if (Notification.permission === "granted") {
      subscribeToPush();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          subscribeToPush();
        }
      });
    }
  }, []);

  return null; // Invisible component
}
