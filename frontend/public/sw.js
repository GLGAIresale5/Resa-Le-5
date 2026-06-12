// Service Worker for GLG AI — Push Notifications + Auto-update
// Change this version string on each deploy to trigger an update
const SW_VERSION = "2026-06-12-calendrier-resas";

self.addEventListener("install", (event) => {
  // Activate immediately — don't wait for old SW to stop
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // Take control of all clients immediately
    self.clients.claim().then(() => {
      // Notify all open windows that a new version is available
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "SW_UPDATED", version: SW_VERSION });
        });
      });
    })
  );
});

// Handle push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/reservations",
    },
    actions: [
      { action: "open", title: "Voir" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "GLG AI", options).then(() => {
      // Set app badge (red dot with count on app icon)
      if (self.navigator && self.navigator.setAppBadge) {
        self.navigator.setAppBadge();
      }
    })
  );
});

// Handle notification click — open the app and clear badge
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Clear badge when user opens the app
  if (self.navigator && self.navigator.clearAppBadge) {
    self.navigator.clearAppBadge();
  }

  const url = event.notification.data?.url || "/reservations";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});

// Respond to version check messages from the app
self.addEventListener("message", (event) => {
  if (event.data?.type === "GET_VERSION") {
    event.source.postMessage({ type: "SW_VERSION", version: SW_VERSION });
  }
});
