// Service worker do orvok: habilita a instalação como aplicativo e guarda só
// ícones e a página inicial estática. Dados e telas logadas sempre vêm da rede.
const CACHE = "orvok-v1";
const ESTATICOS = ["/inicio.html", "/icone-192.png", "/icone-512.png", "/manifest.webmanifest"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESTATICOS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (ESTATICOS.includes(url.pathname)) e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
