self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const openClient = clients.find((client) => "focus" in client);

      if (openClient) {
        return openClient.focus();
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }

      return undefined;
    }),
  );
});
