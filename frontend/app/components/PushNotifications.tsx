"use client";

import { useEffect } from "react";
import { useAuth } from "../lib/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  const { restaurant, session } = useAuth();

  useEffect(() => {
    // Wait until restaurant context + session are loaded
    if (!restaurant?.id || !session?.access_token) return;

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
        await fetch(`${API_URL}/push/subscribe?restaurant_id=${restaurant.id}`, {
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
      } catch (err) {
        console.error("[Push] Auto-subscribe error:", err);
      }
    })();
  }, [restaurant?.id, session?.access_token]);

  // Clear the app-icon badge whenever the back-office is opened or brought to the
  // foreground. The service worker sets a red badge on each new reservation ; opening
  // the app means the owner has seen it, so we dismiss it here (not only on notif tap).
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
    if (typeof nav.clearAppBadge !== "function") return;

    const clear = () => {
      nav.clearAppBadge?.().catch(() => {});
    };

    clear(); // app just opened
    const onVisible = () => {
      if (document.visibilityState === "visible") clear();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}
