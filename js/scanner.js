/* TattooAR — escáner del cliente.

   Modos (según la URL):
     ?t=<id>    un tatuaje publicado (link corto / QR del tatuador).
     ?t=demo    el flash de muestra de la landing.
     ?d=<url>   links antiguos: el .json del diseño (solo de orígenes conocidos).
     ?test=1    prueba desde el generador (diseño en sessionStorage).
     (nada)     UNIVERSAL: reconoce cualquier tatuaje publicado.

   Cómo carga: cada diseño publicado ya trae su reconocimiento compilado (.mind).
   El escáner descarga esos .mind, los FUSIONA en uno y arranca: no recompila nada en el teléfono.
   Lo descargado queda en la caché del navegador, así la segunda visita abre al instante. */
(function () {
  "use strict";

  var CFG = { maxTargets: 40, concurrency: 4, cache: "ta-scan-v2", startTimeout: 25000, tipAfter: 7000, tipEvery: 4500 };
  var DEMO_URL = new URL("assets/demo/flash-01.json", location.href).href;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var params = new URLSearchParams(location.search);
  var $ = function (id) { return document.getElementById(id); };

  /* ================= Textos (ES / EN / PT / FR / DE) ================= */
  var T = {
    es: { live: "En vivo", lang: "Idioma", kicker: "Tatuajes en vivo", title: "Escaneá",
      "text.universal": "Apuntá la cámara a un tatuaje activado y miralo cobrar vida.",
      "text.single": "Apuntá la cámara a este tatuaje y miralo cobrar vida.",
      "text.demo": "Apuntá la cámara al flash de muestra y miralo cobrar vida.",
      "btn.loading": "Cargando…", "btn.scan": "Escanear", "btn.retry": "Reintentar", "btn.camera": "Abriendo cámara…", "btn.prep": "Preparando",
      privacy: "La cámara se procesa en tu celular · No se sube nada",
      inapp: "Estás en el navegador de una app. Si la cámara no abre, copiá el link y abrilo en Safari o Chrome.", copy: "Copiar link",
      "hud.searching": "Buscando tatuaje", "hud.found": "Tatuaje detectado", "hud.resuming": "Reabriendo cámara",
      "ctl.torch": "Linterna", "ctl.share": "Compartir", "ctl.photo": "Foto", "ctl.sound": "Sonido", "ctl.help": "Ayuda", "ctl.close": "Cerrar",
      "help.kicker": "Ayuda", "help.title": "Para que se vea mejor", "help.note": "Si la cámara no abre, revisá el permiso en el candado de la barra de direcciones.",
      "tip.1": "Acercá el celular hasta que el tatuaje llene el visor.", "tip.2": "Buscá buena luz y evitá los reflejos.",
      "tip.3": "Mantené el celular quieto un segundo.", "tip.4": "Estirá la piel para que el diseño quede plano.",
      "shot.title": "Tu foto", "shot.share": "Compartir", "shot.save": "Guardar",
      "toast.copied": "Link copiado", "toast.nophoto": "No se pudo tomar la foto", "toast.notorch": "Este celular no deja usar la linterna acá",
      "share.text": "Mirá cómo se mueve este tatuaje.",
      "err.none": "Todavía no hay tatuajes publicados. Volvé pronto.",
      "err.net": "No pudimos cargar los tatuajes. Revisá tu conexión y reintentá.",
      "err.link": "No pudimos abrir este tatuaje. Podés escanear igual: reconocemos todos los tatuajes activados.",
      "err.denied": "No tenemos permiso para usar la cámara. Tocá el candado de la barra de direcciones, permití la cámara y reintentá.",
      "err.busy": "La cámara no está disponible. Cerrá otras apps que la estén usando y reintentá.",
      "err.unsupported": "Este navegador no permite usar la cámara. Abrí el link en Safari o Chrome.",
      "err.insecure": "La cámara solo funciona en una conexión segura (HTTPS).",
      "err.webgl": "Este dispositivo no puede mostrar la animación. Probá en otro navegador o celular.",
      "err.generic": "No se pudo iniciar el escáner. Reintentá.", "demo.try": "Probar con el flash de muestra" },
    en: { live: "Live", lang: "Language", kicker: "Live tattoos", title: "Scan",
      "text.universal": "Point your camera at an activated tattoo and watch it come alive.",
      "text.single": "Point your camera at this tattoo and watch it come alive.",
      "text.demo": "Point your camera at the sample flash and watch it come alive.",
      "btn.loading": "Loading…", "btn.scan": "Scan", "btn.retry": "Try again", "btn.camera": "Opening camera…", "btn.prep": "Preparing",
      privacy: "The camera is processed on your phone · Nothing is uploaded",
      inapp: "You're in an app's browser. If the camera doesn't open, copy the link and open it in Safari or Chrome.", copy: "Copy link",
      "hud.searching": "Looking for tattoo", "hud.found": "Tattoo detected", "hud.resuming": "Reopening camera",
      "ctl.torch": "Torch", "ctl.share": "Share", "ctl.photo": "Photo", "ctl.sound": "Sound", "ctl.help": "Help", "ctl.close": "Close",
      "help.kicker": "Help", "help.title": "For a better view", "help.note": "If the camera doesn't open, check the permission in the padlock of the address bar.",
      "tip.1": "Move closer until the tattoo fills the viewfinder.", "tip.2": "Find good light and avoid glare.",
      "tip.3": "Hold the phone still for a second.", "tip.4": "Stretch the skin so the design lies flat.",
      "shot.title": "Your photo", "shot.share": "Share", "shot.save": "Save",
      "toast.copied": "Link copied", "toast.nophoto": "Couldn't take the photo", "toast.notorch": "This phone doesn't allow the torch here",
      "share.text": "Watch this tattoo move.",
      "err.none": "No tattoos have been published yet. Come back soon.",
      "err.net": "We couldn't load the tattoos. Check your connection and try again.",
      "err.link": "We couldn't open this tattoo. You can still scan: we recognise every activated tattoo.",
      "err.denied": "We don't have permission to use the camera. Tap the padlock in the address bar, allow the camera and try again.",
      "err.busy": "The camera isn't available. Close other apps using it and try again.",
      "err.unsupported": "This browser can't use the camera. Open the link in Safari or Chrome.",
      "err.insecure": "The camera only works on a secure connection (HTTPS).",
      "err.webgl": "This device can't show the animation. Try another browser or phone.",
      "err.generic": "The scanner couldn't start. Try again.", "demo.try": "Try the sample flash" },
    pt: { live: "Ao vivo", lang: "Idioma", kicker: "Tatuagens ao vivo", title: "Escaneie",
      "text.universal": "Aponte a câmera para uma tatuagem ativada e veja ela ganhar vida.",
      "text.single": "Aponte a câmera para esta tatuagem e veja ela ganhar vida.",
      "text.demo": "Aponte a câmera para o flash de amostra e veja ele ganhar vida.",
      "btn.loading": "Carregando…", "btn.scan": "Escanear", "btn.retry": "Tentar de novo", "btn.camera": "Abrindo a câmera…", "btn.prep": "Preparando",
      privacy: "A câmera é processada no seu celular · Nada é enviado",
      inapp: "Você está no navegador de um app. Se a câmera não abrir, copie o link e abra no Safari ou Chrome.", copy: "Copiar link",
      "hud.searching": "Procurando tatuagem", "hud.found": "Tatuagem detectada", "hud.resuming": "Reabrindo a câmera",
      "ctl.torch": "Lanterna", "ctl.share": "Compartilhar", "ctl.photo": "Foto", "ctl.sound": "Som", "ctl.help": "Ajuda", "ctl.close": "Fechar",
      "help.kicker": "Ajuda", "help.title": "Para ver melhor", "help.note": "Se a câmera não abrir, confira a permissão no cadeado da barra de endereço.",
      "tip.1": "Aproxime o celular até a tatuagem preencher o visor.", "tip.2": "Procure boa luz e evite reflexos.",
      "tip.3": "Segure o celular parado por um segundo.", "tip.4": "Estique a pele para o desenho ficar plano.",
      "shot.title": "Sua foto", "shot.share": "Compartilhar", "shot.save": "Salvar",
      "toast.copied": "Link copiado", "toast.nophoto": "Não deu para tirar a foto", "toast.notorch": "Este celular não permite a lanterna aqui",
      "share.text": "Veja como esta tatuagem se mexe.",
      "err.none": "Ainda não há tatuagens publicadas. Volte em breve.",
      "err.net": "Não conseguimos carregar as tatuagens. Confira sua conexão e tente de novo.",
      "err.link": "Não conseguimos abrir esta tatuagem. Você pode escanear assim mesmo: reconhecemos todas as tatuagens ativadas.",
      "err.denied": "Não temos permissão para usar a câmera. Toque no cadeado da barra de endereço, permita a câmera e tente de novo.",
      "err.busy": "A câmera não está disponível. Feche outros apps que a estejam usando e tente de novo.",
      "err.unsupported": "Este navegador não permite usar a câmera. Abra o link no Safari ou Chrome.",
      "err.insecure": "A câmera só funciona em conexão segura (HTTPS).",
      "err.webgl": "Este aparelho não consegue mostrar a animação. Tente outro navegador ou celular.",
      "err.generic": "Não foi possível iniciar o scanner. Tente de novo.", "demo.try": "Testar com o flash de amostra" },
    fr: { live: "En direct", lang: "Langue", kicker: "Tatouages en direct", title: "Scannez",
      "text.universal": "Pointez la caméra sur un tatouage activé et regardez-le prendre vie.",
      "text.single": "Pointez la caméra sur ce tatouage et regardez-le prendre vie.",
      "text.demo": "Pointez la caméra sur le flash d'exemple et regardez-le prendre vie.",
      "btn.loading": "Chargement…", "btn.scan": "Scanner", "btn.retry": "Réessayer", "btn.camera": "Ouverture de la caméra…", "btn.prep": "Préparation",
      privacy: "La caméra est traitée sur votre téléphone · Rien n'est envoyé",
      inapp: "Vous êtes dans le navigateur d'une appli. Si la caméra ne s'ouvre pas, copiez le lien et ouvrez-le dans Safari ou Chrome.", copy: "Copier le lien",
      "hud.searching": "Recherche du tatouage", "hud.found": "Tatouage détecté", "hud.resuming": "Réouverture de la caméra",
      "ctl.torch": "Lampe", "ctl.share": "Partager", "ctl.photo": "Photo", "ctl.sound": "Son", "ctl.help": "Aide", "ctl.close": "Fermer",
      "help.kicker": "Aide", "help.title": "Pour mieux voir", "help.note": "Si la caméra ne s'ouvre pas, vérifiez l'autorisation dans le cadenas de la barre d'adresse.",
      "tip.1": "Approchez le téléphone jusqu'à ce que le tatouage remplisse le viseur.", "tip.2": "Cherchez une bonne lumière et évitez les reflets.",
      "tip.3": "Tenez le téléphone immobile une seconde.", "tip.4": "Tendez la peau pour que le dessin soit à plat.",
      "shot.title": "Votre photo", "shot.share": "Partager", "shot.save": "Enregistrer",
      "toast.copied": "Lien copié", "toast.nophoto": "Impossible de prendre la photo", "toast.notorch": "Ce téléphone ne permet pas la lampe ici",
      "share.text": "Regardez ce tatouage bouger.",
      "err.none": "Aucun tatouage publié pour l'instant. Revenez bientôt.",
      "err.net": "Impossible de charger les tatouages. Vérifiez votre connexion et réessayez.",
      "err.link": "Impossible d'ouvrir ce tatouage. Vous pouvez quand même scanner : nous reconnaissons tous les tatouages activés.",
      "err.denied": "Nous n'avons pas l'autorisation d'utiliser la caméra. Touchez le cadenas de la barre d'adresse, autorisez la caméra et réessayez.",
      "err.busy": "La caméra n'est pas disponible. Fermez les autres applis qui l'utilisent et réessayez.",
      "err.unsupported": "Ce navigateur ne permet pas d'utiliser la caméra. Ouvrez le lien dans Safari ou Chrome.",
      "err.insecure": "La caméra ne fonctionne qu'en connexion sécurisée (HTTPS).",
      "err.webgl": "Cet appareil ne peut pas afficher l'animation. Essayez un autre navigateur ou téléphone.",
      "err.generic": "Le scanner n'a pas pu démarrer. Réessayez.", "demo.try": "Essayer avec le flash d'exemple" },
    de: { live: "Live", lang: "Sprache", kicker: "Tattoos live", title: "Scannen",
      "text.universal": "Richte die Kamera auf ein aktiviertes Tattoo und sieh zu, wie es lebendig wird.",
      "text.single": "Richte die Kamera auf dieses Tattoo und sieh zu, wie es lebendig wird.",
      "text.demo": "Richte die Kamera auf das Beispiel-Flash und sieh zu, wie es lebendig wird.",
      "btn.loading": "Lädt…", "btn.scan": "Scannen", "btn.retry": "Nochmal", "btn.camera": "Kamera wird geöffnet…", "btn.prep": "Vorbereitung",
      privacy: "Die Kamera wird auf deinem Handy verarbeitet · Nichts wird hochgeladen",
      inapp: "Du bist im Browser einer App. Wenn die Kamera nicht aufgeht, kopiere den Link und öffne ihn in Safari oder Chrome.", copy: "Link kopieren",
      "hud.searching": "Suche Tattoo", "hud.found": "Tattoo erkannt", "hud.resuming": "Kamera wird neu geöffnet",
      "ctl.torch": "Licht", "ctl.share": "Teilen", "ctl.photo": "Foto", "ctl.sound": "Ton", "ctl.help": "Hilfe", "ctl.close": "Schließen",
      "help.kicker": "Hilfe", "help.title": "Für ein besseres Bild", "help.note": "Wenn die Kamera nicht aufgeht, prüfe die Berechtigung im Schloss der Adressleiste.",
      "tip.1": "Geh näher ran, bis das Tattoo den Sucher füllt.", "tip.2": "Such gutes Licht und vermeide Spiegelungen.",
      "tip.3": "Halte das Handy eine Sekunde ruhig.", "tip.4": "Spann die Haut, damit das Design flach liegt.",
      "shot.title": "Dein Foto", "shot.share": "Teilen", "shot.save": "Speichern",
      "toast.copied": "Link kopiert", "toast.nophoto": "Foto konnte nicht aufgenommen werden", "toast.notorch": "Dieses Handy erlaubt das Licht hier nicht",
      "share.text": "Sieh zu, wie sich dieses Tattoo bewegt.",
      "err.none": "Noch keine Tattoos veröffentlicht. Schau bald wieder vorbei.",
      "err.net": "Die Tattoos konnten nicht geladen werden. Prüfe deine Verbindung und versuch es nochmal.",
      "err.link": "Dieses Tattoo ließ sich nicht öffnen. Du kannst trotzdem scannen: Wir erkennen alle aktivierten Tattoos.",
      "err.denied": "Wir haben keine Kamera-Berechtigung. Tippe auf das Schloss in der Adressleiste, erlaube die Kamera und versuch es nochmal.",
      "err.busy": "Die Kamera ist nicht verfügbar. Schließe andere Apps, die sie nutzen, und versuch es nochmal.",
      "err.unsupported": "Dieser Browser kann die Kamera nicht nutzen. Öffne den Link in Safari oder Chrome.",
      "err.insecure": "Die Kamera funktioniert nur über eine sichere Verbindung (HTTPS).",
      "err.webgl": "Dieses Gerät kann die Animation nicht anzeigen. Probier einen anderen Browser oder ein anderes Handy.",
      "err.generic": "Der Scanner konnte nicht starten. Versuch es nochmal.", "demo.try": "Mit dem Beispiel-Flash testen" }
  };
  var HELLOS = ["Hola", "Hello", "Ciao", "Bonjour", "Olá", "こんにちは"];
  var LANGS = ["es", "en", "pt", "fr", "de"];
  var lang = LANGS.indexOf(window.__taLang) >= 0 ? window.__taLang : "es";
  function t(k) { return (T[lang] && T[lang][k]) || T.es[k] || k; }

  /* ================= Elementos y estado ================= */
  var introEl = $("intro"), startBtn = $("startBtn"), startLabel = $("startLabel"), hintEl = $("introHint"), progressEl = $("progress");
  var hudEl = $("hud"), capText = $("capText"), capName = $("capName"), tipEl = $("tip"), liveTag = $("liveTag");
  var torchBtn = $("torchBtn"), shotBtn = $("shotBtn"), shareBtn = $("shareBtn"), soundBtn = $("soundBtn"), toastEl = $("toast");

  var mode = resolveMode();
  var targets = [];        // { id, name, design_url, image_url, design }
  var sceneEl = null, sys = null;
  var ready = false;       // escena montada (los reintentos solo piden cámara)
  var running = false;     // cámara encendida
  var resumeOnShow = false;
  var foundSet = {};       // índices visibles ahora
  var lastFound = -1;
  var labelKey = "btn.loading", hintKey = "", hintIsError = false, capKey = "hud.searching", textKey = "text.universal";
  var tipTimer = 0, cleanTimer = 0, tipIdx = 0, soundOn = false, shotBlob = null, shotUrl = "";

  /* ================= Utilidades ================= */
  function named(name, msg) { var e = new Error(msg || name); e.name = name; return e; }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function num(v, d) { v = +v; return isFinite(v) ? v : d; }
  function abs(u, base) { if (!u) return null; if (/^(data|blob):/i.test(u)) return u; try { return new URL(u, base).href; } catch (e) { return null; } }

  // Solo se abren diseños alojados en orígenes conocidos (este sitio, el Storage del proyecto o el Blob antiguo).
  function isAllowedUrl(u) {
    var url; try { url = new URL(u, location.href); } catch (e) { return false; }
    if (url.origin === location.origin) return true;
    if (url.protocol !== "https:") return false;
    if (window.SUPABASE_URL && url.href.indexOf(window.SUPABASE_URL + "/storage/v1/object/public/") === 0) return true;
    return /\.public\.blob\.vercel-storage\.com$/i.test(url.hostname);
  }
  function resolveMode() {
    var tId = params.get("t"), d = params.get("d"), v = params.get("v");
    if (params.get("test") === "1") return { kind: "test" };
    if (tId === "demo") return { kind: "single", designUrl: DEMO_URL, id: null, demo: true };
    if (tId && UUID.test(tId)) return { kind: "single", id: tId };
    if (d && isAllowedUrl(d)) return { kind: "single", designUrl: new URL(d, location.href).href, id: v && UUID.test(v) ? v : null };
    return { kind: "universal", warn: d || tId ? "err.link" : "" };
  }

  /* ================= Datos: Supabase por REST (sin librería) ================= */
  function sbHeaders() { return { apikey: window.SUPABASE_KEY, Authorization: "Bearer " + window.SUPABASE_KEY }; }
  function hasBackend() { return !!(window.SUPABASE_URL && window.SUPABASE_KEY); }
  async function sbSelect(query) {
    var r = await fetch(window.SUPABASE_URL + "/rest/v1/scan_targets?select=id,name,design_url,image_url" + query, { headers: sbHeaders() });
    if (!r.ok) throw named("NetError", "scan_targets " + r.status);
    return await r.json();
  }
  function demoTarget() { return { id: null, name: "Flash 01", design_url: DEMO_URL, image_url: new URL("assets/demo/flash-01.png", location.href).href, demo: true }; }
  async function fetchAllTargets() {
    if (!hasBackend()) return [demoTarget()];
    var rows = (await sbSelect("&limit=" + CFG.maxTargets)).filter(function (r) { return r.design_url && isAllowedUrl(r.design_url); });
    return rows.length ? rows : [demoTarget()];   // sin diseños reales todavía: queda la muestra
  }
  async function fetchTargetById(id) {
    if (!hasBackend()) return null;
    var rows = await sbSelect("&id=eq." + encodeURIComponent(id) + "&limit=1");
    return rows[0] || null;
  }
  // Cuenta una vista por diseño y por sesión (no infla las estadísticas al perder y recuperar el tatuaje).
  function countView(id) {
    if (!id || !UUID.test(id) || !hasBackend()) return;
    try { if (sessionStorage.getItem("ta:v:" + id)) return; sessionStorage.setItem("ta:v:" + id, "1"); } catch (e) {}
    var h = sbHeaders(); h["Content-Type"] = "application/json";
    fetch(window.SUPABASE_URL + "/rest/v1/rpc/increment_view", { method: "POST", headers: h, body: JSON.stringify({ d: id }), keepalive: true }).catch(function () {});
  }

  /* ================= Diseños y reconocimiento (.mind) ================= */
  var cachePromise = null;
  function openCache() {
    if (!cachePromise) cachePromise = ("caches" in window ? caches.open(CFG.cache) : Promise.reject()).catch(function () { return null; });
    return cachePromise;
  }
  async function fetchOk(url) {
    var r = await fetch(url, { mode: "cors" });
    if (!r.ok) throw named("NetError", url + " -> " + r.status);
    return r;
  }
  function normalizeDesign(d, base) {
    if (!d || typeof d !== "object") throw named("DesignError", "empty");
    var c = d.content || (d.effect ? Object.assign({ type: "effect" }, d.effect) : { type: "effect", id: "glow-pulse" });
    c = Object.assign({}, c);
    if (c.type === "video") { c.url = abs(c.url, base); if (!c.url) throw named("DesignError", "video"); }
    return { name: typeof d.name === "string" ? d.name : "", image: abs(d.image, base), mindB64: typeof d.mind === "string" ? d.mind : null,
      mindUrl: abs(d.mindUrl, base), content: c, targetAspect: num(d.targetAspect, 0) || null };
  }
  // Los .json publicados son inmutables (ruta única por publicación): se guardan en caché.
  async function fetchDesign(url) {
    var cacheable = new URL(url).origin !== location.origin, c = cacheable ? await openCache() : null, res = null;
    if (c) { try { res = await c.match(url); } catch (e) {} }
    if (!res) {
      res = await fetchOk(url);
      if (c) { try { await c.put(url, res.clone()); } catch (e) {} }
    }
    return normalizeDesign(await res.json(), url);
  }
  function b64ToBuffer(b64) {
    var bin = atob(b64), n = bin.length, bytes = new Uint8Array(n);
    for (var i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  async function getMind(target) {
    var key = location.origin + "/__ta-mind/" + encodeURIComponent(target.design_url || "");
    var c = target.design_url && !target.demo ? await openCache() : null;
    if (c) { try { var hit = await c.match(key); if (hit) return await hit.arrayBuffer(); } catch (e) {} }
    if (!target.design) target.design = await fetchDesign(target.design_url);
    var d = target.design, buf;
    if (d.mindUrl) buf = await (await fetchOk(d.mindUrl)).arrayBuffer();
    else if (d.mindB64) buf = b64ToBuffer(d.mindB64);
    else throw named("DesignError", "no-mind");
    d.mindB64 = null;                                  // ya no hace falta en memoria
    if (c) { try { await c.put(key, new Response(buf.slice(0))); } catch (e) {} }
    return buf;
  }
  // Fusiona los .mind de cada diseño en uno solo (un target por diseño, en el mismo orden). Sin recompilar.
  function mergeMinds(list, buffers) {
    var Compiler = window.MINDAR.IMAGE.Compiler, merged = new Compiler(), keep = [];
    merged.data = [];
    for (var i = 0; i < buffers.length; i++) {
      if (!buffers[i]) continue;
      var data = [];
      try { data = new Compiler().importData(buffers[i]) || []; } catch (e) { data = []; }
      if (!data.length) { console.warn("[tattoo-ar] .mind incompatible:", list[i].design_url); continue; }
      merged.data.push(data[0]);
      keep.push(list[i]);
    }
    if (!keep.length) throw named("DesignError", "no-targets");
    return { targets: keep, buffer: merged.exportData() };
  }
  // Ejecuta tareas con un tope de simultáneas; las que fallan devuelven null.
  async function pool(items, limit, worker, onStep) {
    var out = new Array(items.length), next = 0, done = 0;
    async function run() {
      while (next < items.length) {
        var i = next++;
        try { out[i] = await worker(items[i], i); } catch (e) { console.warn("[tattoo-ar] diseño omitido:", e && e.message); out[i] = null; }
        done++; if (onStep) onStep(done, items.length);
      }
    }
    var runners = [];
    for (var k = 0; k < Math.min(limit, items.length); k++) runners.push(run());
    await Promise.all(runners);
    return out;
  }

  /* ================= Interfaz: textos ================= */
  function applyLang(next) {
    if (LANGS.indexOf(next) >= 0) lang = next;
    document.documentElement.setAttribute("lang", lang);
    try { localStorage.setItem("ta:lang", lang); } catch (e) {}
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    $("introText").textContent = t(textKey);
    paintLabel(); paintHint(); paintCap();
    $("helpBtn").setAttribute("aria-label", t("ctl.help")); soundBtn.setAttribute("aria-label", t("ctl.sound")); shotBtn.setAttribute("aria-label", t("ctl.photo"));
    document.querySelectorAll("[data-close]").forEach(function (b) { b.setAttribute("aria-label", t("ctl.close")); });
    var sel = $("langSel"); if (sel) sel.value = lang;
  }
  var labelExtra = "";
  function paintLabel() { startLabel.textContent = t(labelKey) + labelExtra; }
  function setLabel(key, extra) { labelKey = key; labelExtra = extra || ""; paintLabel(); }
  function paintHint() { hintEl.textContent = hintKey ? t(hintKey) : ""; hintEl.classList.toggle("is-error", hintIsError); }
  function setHint(key, isError) { hintKey = key || ""; hintIsError = !!isError; paintHint(); }
  function paintCap() { capText.textContent = t(capKey); }
  function setProgress(p) {
    if (p == null) { progressEl.hidden = true; return; }
    progressEl.hidden = false; progressEl.setAttribute("aria-valuenow", Math.round(p * 100));
    progressEl.firstElementChild.style.transform = "scaleX(" + Math.max(0.02, Math.min(1, p)) + ")";
  }
  var toastTimer = 0;
  function toast(key) {
    toastEl.textContent = t(key); toastEl.classList.add("is-on");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove("is-on"); }, 2200);
  }

  /* ================= Inicio ================= */
  function hello() {
    var el = $("scan-preloader");
    try { if (sessionStorage.getItem("ta:hello")) return; sessionStorage.setItem("ta:hello", "1"); } catch (e) {}
    if (!el || !el.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var word = el.querySelector("span"), i = 0;
    el.classList.add("is-on"); word.textContent = HELLOS[0];
    var timer = setInterval(function () {
      i++;
      if (i < HELLOS.length) { word.textContent = HELLOS[i]; return; }
      clearInterval(timer);
      var off = function () { el.classList.remove("is-on"); };
      el.animate([{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }], { duration: 620, easing: "cubic-bezier(.76,0,.24,1)", fill: "forwards" })
        .onfinish = off;
      setTimeout(off, 1400);   // red de seguridad: si el navegador no dibuja (pestaña en segundo plano), igual se retira

    }, 190);
  }

  function showThumb(url) {
    if (!url) return;
    var img = $("thumbImg");
    img.onload = function () { $("thumb").hidden = false; };
    img.onerror = function () { $("thumb").hidden = true; };
    img.src = url;
  }

  async function init() {
    applyLang(lang);
    hello();
    bindUi();
    if (/Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Line\/|MicroMessenger|Snapchat/i.test(navigator.userAgent)) $("inapp").hidden = false;
    if (!window.AFRAME || !window.MINDAR || !window.MINDAR.IMAGE) { setLabel("btn.retry"); startBtn.disabled = false; startBtn.onclick = function () { location.reload(); }; return setHint("err.net", true); }
    if (!webglOk()) { setLabel("btn.scan"); return setHint("err.webgl", true); }

    if (mode.kind === "single" || mode.kind === "test") {
      try { await prepareSingle(); }
      catch (err) {
        console.error("[tattoo-ar] diseño:", err);
        mode = { kind: "universal", warn: "err.link" };   // el link falló: el escáner universal sigue sirviendo
        targets = [];
      }
    }
    if (mode.kind === "universal") {
      textKey = "text.universal"; $("introText").textContent = t(textKey);
      if (mode.warn) setHint(mode.warn, true);
    }
    setLabel("btn.scan");
    startBtn.disabled = false;
    startBtn.onclick = start;
  }
  function webglOk() {
    try { var c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
  }

  // Un solo tatuaje: se deja todo listo antes de tocar "Escanear" para que la cámara abra rápido.
  async function prepareSingle() {
    var target;
    if (mode.kind === "test") {
      var raw = sessionStorage.getItem("tattooar:test-design");
      if (!raw) throw named("DesignError", "no-test");
      target = { id: null, name: "", design_url: "", design: normalizeDesign(JSON.parse(raw), location.href) };
    } else {
      var row = null;
      if (mode.id && !mode.designUrl) {
        row = await fetchTargetById(mode.id);
        if (!row || !isAllowedUrl(row.design_url)) throw named("DesignError", "not-found");
        mode.designUrl = row.design_url;
      }
      target = { id: mode.id || null, name: (row && row.name) || "", design_url: mode.designUrl, image_url: row && row.image_url, demo: !!mode.demo };
      target.design = await fetchDesign(target.design_url);
      if (!target.name) target.name = target.design.name;
    }
    var d = target.design;
    if (d.content.type !== "video" && !d.image) throw named("DesignError", "no-image");
    targets = [target];
    textKey = mode.demo ? "text.demo" : "text.single"; $("introText").textContent = t(textKey);
    showThumb(mode.demo ? new URL("assets/demo/flash-01.png", location.href).href : (target.image_url || (d.content.type !== "video" ? d.image : null)));
  }

  /* ================= Arranque del escáner ================= */
  async function start() {
    startBtn.disabled = true;
    setHint("");
    $("demoLink").hidden = true;
    try {
      if (!ready) {
        if (mode.kind === "universal") {
          setLabel("btn.prep"); setProgress(0.03);
          targets = await fetchAllTargets();
          if (!targets.length) { setProgress(null); setLabel("btn.scan"); startBtn.disabled = false; return setHint("err.none"); }
        } else { setLabel("btn.prep"); setProgress(0.2); }
        var total = targets.length;
        var buffers = await pool(targets, CFG.concurrency, getMind, function (done) {
          setProgress(0.05 + 0.85 * (done / total));
          if (total > 1) setLabel("btn.prep", " " + done + "/" + total);
        });
        var merged = mergeMinds(targets, buffers);
        targets = merged.targets;
        buildScene(URL.createObjectURL(new Blob([merged.buffer], { type: "application/octet-stream" })));
        await sceneLoaded();
        setProgress(1);
        ready = true;
      }
      setLabel("btn.camera");
      await openCamera();
      setProgress(null);
      enterAr();
    } catch (err) {
      console.error("[tattoo-ar] start:", err);
      leaveAr();
      setProgress(null);
      setLabel("btn.retry");
      startBtn.disabled = false;
      var key = errorKey(err);
      setHint(key, true);
      // Sin servidor no hay tatuajes que cargar: la muestra sigue funcionando sin conexión al backend.
      $("demoLink").hidden = !(key === "err.net" && !mode.demo);
    }
  }
  function errorKey(err) {
    var n = (err && err.name) || "";
    if (n === "NotAllowedError" || n === "SecurityError") return "err.denied";
    if (n === "NotFoundError" || n === "NotReadableError" || n === "OverconstrainedError" || n === "AbortError" || n === "ARError" || n === "TimeoutError") return "err.busy";
    if (n === "NotSupportedError") return "err.unsupported";
    if (n === "InsecureError") return "err.insecure";
    if (n === "NetError" || n === "DesignError" || n === "TypeError") return "err.net";
    return "err.generic";
  }

  /* ================= Escena AR ================= */
  function buildScene(mindUrl) {
    var n = targets.length;
    sceneEl = document.createElement("a-scene");
    sceneEl.setAttribute("mindar-image", {
      imageTargetSrc: mindUrl, autoStart: false, uiScanning: "no", uiLoading: "no", uiError: "no",
      filterMinCF: 0.0001, filterBeta: 0.01, warmupTolerance: 4, missTolerance: 8, maxTrack: Math.min(n, 2)
    });
    sceneEl.setAttribute("color-space", "sRGB");
    sceneEl.setAttribute("renderer", "colorManagement: true; alpha: true; antialias: true; precision: high");
    sceneEl.setAttribute("vr-mode-ui", "enabled: false");
    sceneEl.setAttribute("device-orientation-permission-ui", "enabled: false");
    sceneEl.setAttribute("embedded", "");
    sceneEl.addEventListener("loaded", function () {
      if (sceneEl.renderer) sceneEl.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }, { once: true });

    var assets = document.createElement("a-assets");
    assets.setAttribute("timeout", "1");               // el contenido se carga al detectar: no bloquea la escena
    sceneEl.appendChild(assets);
    var cam = document.createElement("a-camera");
    cam.setAttribute("position", "0 0 0");
    cam.setAttribute("look-controls", "enabled: false");
    cam.setAttribute("active", "true");
    sceneEl.appendChild(cam);

    targets.forEach(function (target, i) {
      var el = document.createElement("a-entity");
      el.setAttribute("mindar-image-target", "targetIndex: " + i);
      el.addEventListener("targetFound", function () { el.__taFound = true; hydrate(i, el, assets); onFound(i); });
      el.addEventListener("targetLost", function () { el.__taFound = false; onLost(i); });
      target.el = el;
      sceneEl.appendChild(el);
      // Con un solo tatuaje el contenido se arma ya, para que aparezca en el instante de detectarlo.
      if (n === 1 && target.design) hydrate(i, el, assets);
    });
    $("ar-root").appendChild(sceneEl);
  }
  function sceneLoaded() {
    return new Promise(function (resolve) {
      if (sceneEl.hasLoaded) resolve(); else sceneEl.addEventListener("loaded", function () { resolve(); }, { once: true });
    });
  }
  // Arma la animación de un target (una sola vez). Si llega después de detectarlo, el componente arranca visible.
  async function hydrate(i, el, assets) {
    if (el.__taBuilt) return;
    el.__taBuilt = true;
    try {
      var target = targets[i];
      if (!target.design) target.design = await fetchDesign(target.design_url);
      el.appendChild(makeContent(target.design, i, assets));
      if (el.__taFound) soundBtn.hidden = target.design.content.type !== "video";
    } catch (e) { el.__taBuilt = false; console.warn("[tattoo-ar] contenido:", e); }
  }
  function makeContent(d, i, assets) {
    var c = d.content, plane = document.createElement("a-entity");
    if (c.type === "video") {
      var video = document.createElement("video");
      video.id = "ta-vid-" + i;
      video.crossOrigin = "anonymous"; video.loop = true; video.muted = !soundOn; video.playsInline = true;
      video.setAttribute("playsinline", ""); video.setAttribute("webkit-playsinline", ""); video.preload = "auto";
      video.src = c.url;
      assets.appendChild(video);
      targets[i].video = video;
      var w = num(c.width, 1);
      var size = function (aspect) { plane.setAttribute("geometry", { primitive: "plane", width: w, height: +(w * aspect).toFixed(4) }); };
      size(d.targetAspect || 1);
      if (!d.targetAspect) video.addEventListener("loadedmetadata", function () { size(video.videoHeight / video.videoWidth || 1); }, { once: true });
      plane.setAttribute("rotation", { x: 0, y: 0, z: num(c.rot, 0) });
      plane.setAttribute("keyed-video", {
        src: "#" + video.id, mode: ["luma-white", "luma-black", "chroma", "none"].indexOf(c.mode) >= 0 ? c.mode : "luma-white",
        white: num(c.white, 0.86), soft: num(c.soft, 0.12), contrast: num(c.contrast, 1.12), zoom: num(c.zoom, 1),
        offx: num(c.offx, 0), offy: num(c.offy, 0), flipx: !!c.flipx, threshold: num(c.threshold, 0.04),
        keyColor: /^#[0-9a-f]{3,8}$/i.test(c.keyColor || "") ? c.keyColor : "#00ff00"
      });
    } else {
      var art = document.createElement("img");
      art.id = "ta-art-" + i;
      art.crossOrigin = "anonymous";
      art.src = d.image;
      assets.appendChild(art);
      plane.setAttribute("geometry", { primitive: "plane", width: 1, height: d.targetAspect || 1 });
      if (!d.targetAspect) art.addEventListener("load", function () {
        plane.setAttribute("geometry", { primitive: "plane", width: 1, height: art.naturalHeight / art.naturalWidth || 1 });
      }, { once: true });
      plane.setAttribute("living-tattoo", {
        src: "#" + art.id, effect: /^[a-z0-9-]{1,40}$/i.test(c.id || "") ? c.id : "glow-pulse", p1: num(c.p1, 1), p2: num(c.p2, 0.9),
        accent: /^#[0-9a-f]{3,8}$/i.test(c.accent || "") ? c.accent : "#c8f560", useMaskLuma: !!c.useMaskLuma
      });
    }
    return plane;
  }

  /* ================= Cámara ================= */
  async function openCamera() {
    if (!window.isSecureContext) throw named("InsecureError");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw named("NotSupportedError");
    // Pedimos permiso antes para poder mostrar un error claro (MindAR solo avisa "falló el video").
    var probe = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    probe.getTracks().forEach(function (tr) { tr.stop(); });
    await delay(160);
    await startAr();
  }
  function startAr() {
    sys = sceneEl.systems["mindar-image-system"];
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { done(named("TimeoutError")); }, CFG.startTimeout);
      function onReady() { done(); }
      function onError() { done(named("ARError")); }
      function done(err) {
        clearTimeout(timer);
        sceneEl.removeEventListener("arReady", onReady); sceneEl.removeEventListener("arError", onError);
        if (err) reject(err); else resolve();
      }
      sceneEl.addEventListener("arReady", onReady);
      sceneEl.addEventListener("arError", onError);
      try { sys.start(); } catch (e) { done(e); }
    });
  }
  function stopAr() {
    try { if (sys && sys.video) sys.stop(); } catch (e) { console.warn("[tattoo-ar] stop:", e); }
    running = false;
  }
  function videoTrack() {
    var v = sys && sys.video, s = v && v.srcObject;
    return s && s.getVideoTracks ? s.getVideoTracks()[0] : null;
  }

  function enterAr() {
    running = true;
    document.body.classList.add("ar-on");
    introEl.classList.add("is-out");
    hudEl.hidden = false; liveTag.hidden = false;
    foundSet = {}; setSearching();
    setupTorch();
    setLabel("btn.scan"); startBtn.disabled = false;
  }
  function leaveAr() {
    stopAr();
    document.body.classList.remove("ar-on");
    introEl.classList.remove("is-out");
    hudEl.hidden = true; liveTag.hidden = true; soundBtn.hidden = true;
    clearTimeout(tipTimer); clearTimeout(cleanTimer);
  }

  /* ================= Visor: buscando / detectado ================= */
  function setSearching() {
    capKey = "hud.searching"; paintCap(); capName.textContent = "";
    hudEl.classList.remove("is-found", "is-clean"); hudEl.classList.add("is-searching");
    soundBtn.hidden = true;
    clearTimeout(cleanTimer); clearTimeout(tipTimer);
    tipEl.hidden = true;
    tipTimer = setTimeout(nextTip, CFG.tipAfter);
  }
  function nextTip() {
    if (!running || hudEl.classList.contains("is-found")) return;
    tipIdx = (tipIdx % 4) + 1;
    tipEl.hidden = true; void tipEl.offsetWidth;        // reinicia la animación de entrada
    tipEl.textContent = t("tip." + tipIdx); tipEl.hidden = false;
    tipTimer = setTimeout(nextTip, CFG.tipEvery);
  }
  function onFound(i) {
    foundSet[i] = true; lastFound = i;
    var target = targets[i];
    capKey = "hud.found"; paintCap();
    capName.textContent = target && target.name && !/^(tatuaje|diseño)\b/i.test(target.name) ? target.name : "";
    hudEl.classList.remove("is-searching", "is-clean"); hudEl.classList.add("is-found");
    tipEl.hidden = true; clearTimeout(tipTimer);
    soundBtn.hidden = !(target && target.design && target.design.content.type === "video");
    clearTimeout(cleanTimer);
    cleanTimer = setTimeout(function () { hudEl.classList.add("is-clean"); }, 2200);   // deja ver el tatuaje sin el visor encima
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) {} }
    countView(target && target.id);
  }
  function onLost(i) {
    delete foundSet[i];
    if (!Object.keys(foundSet).length) setSearching();
  }

  /* ================= Linterna, sonido, foto, compartir ================= */
  function setupTorch() {
    var track = videoTrack(), caps = track && track.getCapabilities ? track.getCapabilities() : null;
    torchBtn.hidden = !(caps && caps.torch);
    torchBtn.setAttribute("aria-pressed", "false");
  }
  async function toggleTorch() {
    var track = videoTrack(); if (!track) return;
    var on = torchBtn.getAttribute("aria-pressed") !== "true";
    try { await track.applyConstraints({ advanced: [{ torch: on }] }); torchBtn.setAttribute("aria-pressed", on ? "true" : "false"); }
    catch (e) { toast("toast.notorch"); }
  }
  function toggleSound() {
    soundOn = !soundOn;
    soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    targets.forEach(function (tg) { if (tg.video) tg.video.muted = !soundOn; });
  }

  // Foto: cuadro de la cámara + la animación AR, tal como se ve en pantalla.
  async function takePhoto() {
    if (!running || !sys || !sys.video) return;
    try {
      var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      var cv = document.createElement("canvas"); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      var c = cv.getContext("2d"); c.scale(dpr, dpr);
      c.fillStyle = "#0b0b0b"; c.fillRect(0, 0, W, H);
      var vr = sys.video.getBoundingClientRect();
      c.drawImage(sys.video, vr.left, vr.top, vr.width, vr.height);
      var glCanvas = sceneEl.canvas, cr = glCanvas.getBoundingClientRect();
      sceneEl.renderer.render(sceneEl.object3D, sceneEl.camera);     // el búfer WebGL solo es válido en este mismo instante
      c.drawImage(glCanvas, cr.left, cr.top, cr.width, cr.height);
      stamp(c, W, H);
      var flash = $("flash"); flash.classList.remove("is-on"); void flash.offsetWidth; flash.classList.add("is-on");
      shotBlob = await new Promise(function (r) { cv.toBlob(r, "image/jpeg", 0.92); });
      if (!shotBlob) throw new Error("toBlob");
      if (shotUrl) URL.revokeObjectURL(shotUrl);
      shotUrl = URL.createObjectURL(shotBlob);
      $("shotImg").src = shotUrl; $("shotSave").href = shotUrl;
      var canShareFile = false;
      try { canShareFile = !!(navigator.canShare && navigator.canShare({ files: [new File([shotBlob], "tattooar.jpg", { type: "image/jpeg" })] })); } catch (e) {}
      $("shotShare").hidden = !canShareFile;
      openSheet("shotSheet");
    } catch (e) { console.warn("[tattoo-ar] foto:", e); toast("toast.nophoto"); }
  }
  // Sello de marca en la foto: bloque AR_ + dominio.
  function stamp(c, W, H) {
    var x = 18, y = H - 46, bw = 54, bh = 26;
    c.fillStyle = "#c8f560"; c.fillRect(x, y, bw, bh);
    c.fillStyle = "#0b0b0b"; c.font = "700 15px 'Space Mono', ui-monospace, monospace"; c.textBaseline = "middle"; c.textAlign = "left";
    c.fillText("AR_", x + 9, y + bh / 2 + 1);
    c.fillStyle = "rgba(242,240,235,.92)"; c.font = "700 11px 'Space Mono', ui-monospace, monospace";
    c.shadowColor = "rgba(0,0,0,.7)"; c.shadowBlur = 6;
    c.fillText("TATTOO.AR", x + bw + 10, y + bh / 2 + 1);
    c.shadowBlur = 0;
  }
  function shareUrl() {
    var base = new URL("scan.html", location.href).href, tg = targets[lastFound] || (targets.length === 1 ? targets[0] : null);
    if (mode.demo || (tg && tg.demo)) return base + "?t=demo";
    if (tg && tg.id) return base + "?t=" + tg.id;
    if (mode.kind === "single" && mode.designUrl) return location.href.split("#")[0];
    return base;
  }
  async function copyLink(url) {
    try { await navigator.clipboard.writeText(url); toast("toast.copied"); }
    catch (e) { window.prompt(t("copy"), url); }
  }
  async function shareLink() {
    var url = shareUrl();
    if (navigator.share) {
      try { await navigator.share({ title: "TattooAR", text: t("share.text"), url: url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    copyLink(url);
  }
  async function sharePhoto() {
    if (!shotBlob) return;
    try { await navigator.share({ files: [new File([shotBlob], "tattooar.jpg", { type: "image/jpeg" })], title: "TattooAR", text: t("share.text") }); }
    catch (e) { /* cancelado por la persona */ }
  }

  /* ================= Hojas y eventos ================= */
  var lastFocus = null;
  function openSheet(id) { lastFocus = document.activeElement; var s = $(id); s.hidden = false; var x = s.querySelector("[data-close]"); if (x) x.focus(); }
  function closeSheets() {
    ["helpSheet", "shotSheet"].forEach(function (id) { $(id).hidden = true; });
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function bindUi() {
    $("langSel").addEventListener("change", function (e) { applyLang(e.target.value); });
    $("helpBtn").addEventListener("click", function () { openSheet("helpSheet"); });
    $("copyBtn").addEventListener("click", function () { copyLink(location.href); });
    torchBtn.addEventListener("click", toggleTorch);
    soundBtn.addEventListener("click", toggleSound);
    shotBtn.addEventListener("click", takePhoto);
    shareBtn.addEventListener("click", shareLink);
    $("shotShare").addEventListener("click", sharePhoto);
    document.querySelectorAll(".s-sheet").forEach(function (s) {
      s.addEventListener("click", function (e) { if (e.target === s || e.target.closest("[data-close]")) closeSheets(); });
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheets(); });

    // Al salir de la pestaña se suelta la cámara (batería y privacidad); al volver, se reabre.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (running) { resumeOnShow = true; stopAr(); }
      } else if (resumeOnShow) {
        resumeOnShow = false;
        capKey = "hud.resuming"; paintCap();
        startAr().then(function () { running = true; foundSet = {}; setSearching(); setupTorch(); })
          .catch(function (err) { console.error("[tattoo-ar] resume:", err); leaveAr(); setLabel("btn.retry"); setHint(errorKey(err), true); });
      }
    });
    window.addEventListener("pagehide", function () { if (running) stopAr(); });
  }

  init();
})();
