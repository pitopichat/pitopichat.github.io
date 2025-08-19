self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/")) {
      event.respondWith(
          caches.match(event.request).then((response) => {
              return response || fetch(event.request);
          })
      );
  }
});
