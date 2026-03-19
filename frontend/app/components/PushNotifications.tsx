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

/**
 * Silent component — auto-subscribes to push if permission is already granted.
 * The actual permission prompt is handled in /parametres.
 */
export default function PushNotifications() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    // Permission already granted — ensure subscription is active
    (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        // Check if already subscribed
        const existing = await registration.pushManager.getSubscription();
        if (existing) return; // Already subscribed

        const keyResponse = await fetch(`${API_URL}/push/vapid-public-key`);
        const { publicKey } = await keyResponse.json();
        if (!publicKey) return;

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
      } catch (err) {
        console.error("[Push] Auto-subscribe error:", err);
      }
    })();
  }, []);

  return null;
}
