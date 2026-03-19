// Service Worker for GLG AI — Push Notifications

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
