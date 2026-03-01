const CACHE_NAME = "color-cove-shell-v3";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./zoom.js",
  "./storage.js",
  "./manifest.json",
  "./pages/pages.json",
  "./icons/icon.svg",
  "./icons/maskable.svg",
  "./Assets/optimized/90_Valentines.webp",
  "./Assets/optimized/91_Valentines.webp",
  "./Assets/optimized/92_Valentines.webp",
  "./Assets/optimized/93_Valentines.webp",
  "./Assets/thumbs/90_Valentines_thumb.webp",
  "./Assets/thumbs/91_Valentines_thumb.webp",
  "./Assets/thumbs/92_Valentines_thumb.webp",
  "./Assets/thumbs/93_Valentines_thumb.webp",
  "./Assets/90_Valentines.PNG",
  "./Assets/91_Valentines.PNG",
  "./Assets/92_Valentines.PNG",
  "./Assets/93_Valentines.PNG"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isNavigate = event.request.mode === "navigate";

  if (isNavigate) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
