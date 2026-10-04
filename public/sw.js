// Service worker do orvok: habilita a instalação como aplicativo e guarda só
// ícones e a página inicial estática. Dados e telas logadas sempre vêm da rede.
//
// CACHE precisa mudar a cada deploy que altere algo estático (inicio.html,
// inicio.js, pixel.js, ícones). O navegador só detecta que o service worker
// "mudou" comparando os bytes deste arquivo — como CACHE era uma string fixa,
// sw.js nunca mudava de um deploy para o outro, o navegador nunca reinstalava
// o worker, e /inicio.html ficava congelado na primeira versão que cada
// visitante carregou. Foi exatamente isso que travou o clique em "/comecar"
// (a página hidratava contra um HTML desatualizado e o React descartava os
// listeners). Bump manual por enquanto: suba este número a cada deploy que
// mexer em algum arquivo estático.
const CACHE = "orvok-v2";
const ESTATICOS = ["/inicio.html", "/icone-192.png", "/icone-512.png", "/manifest.webmanifest"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESTATICOS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/inicio.html") {
    // Rede primeiro: a home é o destino de todos os anúncios e muda com
    // frequência. O cache só entra como rede de segurança (modo offline).
    e.respondWith(fetch(e.request).then((r) => { caches.open(CACHE).then((c) => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  if (ESTATICOS.includes(url.pathname)) e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

// Avisos push: mostra o aviso (obrigatório para o navegador deixar o site
// rodar em segundo plano) e, quando vem um número, atualiza o selo do
// ícone — assim ele fica certo mesmo com o orvok fechado.
self.addEventListener("push", (e) => {
  let dados = { titulo: "orvok", corpo: "Você tem uma novidade no orvok.", url: "/painel", selo: undefined };
  try { dados = { ...dados, ...e.data.json() }; } catch { /* usa o texto padrão */ }
  e.waitUntil((async () => {
    if (typeof dados.selo === "number" && "setAppBadge" in self.registration) {
      await (dados.selo > 0 ? self.registration.setAppBadge(dados.selo) : self.registration.clearAppBadge()).catch(() => undefined);
    }
    await self.registration.showNotification(dados.titulo, { body: dados.corpo, icon: "/icone-192.png", badge: "/icone-192.png", data: { url: dados.url } });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/painel";
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => {
    const aberta = cs.find((c) => new URL(c.url).pathname === url);
    if (aberta) return aberta.focus();
    return self.clients.openWindow(url);
  }));
});

// Se o navegador trocar a inscrição sozinho (acontece de vez em quando),
// tenta renovar com a mesma chave e avisar o servidor da nova inscrição.
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil((async () => {
    try {
      const nova = await self.registration.pushManager.subscribe(e.oldSubscription ? { applicationServerKey: e.oldSubscription.options.applicationServerKey, userVisibleOnly: true } : undefined);
      await fetch("/api/v1/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(nova.toJSON()) });
    } catch { /* sem sorte desta vez; a pessoa pode reativar manualmente */ }
  })());
});
