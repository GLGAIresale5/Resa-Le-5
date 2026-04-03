"use client";

import { useEffect } from "react";

/**
 * Registers the service worker and checks for updates every 60 seconds.
 * When a new version is detected, the page reloads automatically.
 */
export default function ServiceWorkerUpdater() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    // Listen for SW update messages
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") {
        // New SW activated — reload to get the latest code
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    // Register and set up periodic update checks
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        registration = reg;

        // When a new SW is installed and waiting, activate it immediately
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated") {
              window.location.reload();
            }
          });
        });
      })
      .catch(() => {
        // SW registration failed — not critical
      });

    // Check for updates every 60 seconds
    const interval = setInterval(() => {
      registration?.update().catch(() => {});
    }, 60_000);

    return () => {
      clearInterval(interval);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
