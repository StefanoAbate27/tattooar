/* TattooAR — landing: loader, navegación, idioma/tema, scroll, demo del escáner,
   "Tinta viva" interactiva, galería, QR de la demo y transición entre páginas.
   Todo degrada bien: sin GSAP o con "reducir movimiento" la página se ve completa y quieta. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement, body = doc.body;
  var hasGsap = typeof window.gsap !== "undefined";
  var hasST = hasGsap && typeof window.ScrollTrigger !== "undefined";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var I = window.taI18n;
  var lenis = null;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || doc).querySelectorAll(s)); };
  if (hasST) gsap.registerPlugin(ScrollTrigger);

  // Corre fn solo mientras el elemento está en pantalla y la pestaña visible.
  function whileVisible(el, fn, margin) {
    var raf = 0, on = false, seen = false;
    function loop(t) { fn(t); raf = on ? requestAnimationFrame(loop) : 0; }
    function update() {
      var want = seen && !doc.hidden;
      if (want && !on) { on = true; raf = requestAnimationFrame(loop); }
      else if (!want && on) { on = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    }
    new IntersectionObserver(function (es) { seen = es[0].isIntersecting; update(); }, { rootMargin: margin || "150px" }).observe(el);
    doc.addEventListener("visibilitychange", update);
  }

  /* ---------- Idioma y tema ---------- */
  function initPrefs() {
    if (I) I.apply(window.__taLang || "es");
    var themeUse = $("#themeUse"), meta = $('meta[name="theme-color"]');
    function paintTheme() {
      var light = root.getAttribute("data-theme") === "light";
      if (themeUse) themeUse.setAttribute("href", light ? "#i-moon" : "#i-sun");
      if (meta) meta.setAttribute("content", light ? "#f2f0eb" : "#0b0b0b");
    }
    paintTheme();
    var themeBtn = $("#themeBtn");
    if (themeBtn) themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("ta:theme", next); } catch (e) {}
      paintTheme();
    });
    var langBtn = $("#langBtn"), langMenu = $("#langMenu");
    if (!langBtn || !langMenu) return;
    function setOpen(o) { langMenu.classList.toggle("is-open", o); langBtn.setAttribute("aria-expanded", o ? "true" : "false"); }
    langBtn.addEventListener("click", function (e) { e.stopPropagation(); setOpen(!langMenu.classList.contains("is-open")); });
    $$("[data-lang]", langMenu).forEach(function (b) {
      b.addEventListener("click", function () { if (I) I.apply(b.getAttribute("data-lang")); setOpen(false); });
    });
    doc.addEventListener("click", function (e) { if (!langMenu.contains(e.target)) setOpen(false); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  }

  /* ---------- Scroll suave ---------- */
  function initScroll() {
    if (typeof window.Lenis !== "undefined" && !reduce) {
      lenis = new Lenis({ duration: 1.1, smoothWheel: true });
      window.__lenis = lenis;
      if (hasST) {
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
        gsap.ticker.lagSmoothing(0);
      } else {
        (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
      }
    }
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        var target = id.length > 1 ? $(id) : null;
        if (!target) return;
        e.preventDefault();
        closeMenu();
        var off = id === "#top" ? 0 : -60;
        if (lenis) lenis.scrollTo(target, { offset: off });
        else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + off, behavior: reduce ? "auto" : "smooth" });
        if (history.replaceState) history.replaceState(null, "", id === "#top" ? location.pathname + location.search : id);
      });
    });
  }

  /* ---------- Navegación ---------- */
  var menuEl, menuBtn;
  function closeMenu() {
    if (!menuEl || !menuEl.classList.contains("is-open")) return;
    menuEl.classList.remove("is-open"); menuEl.setAttribute("aria-hidden", "true");
    body.classList.remove("menu-open"); menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.firstElementChild.textContent = I ? I.t("nav.menu") : "Menú";
    if (lenis) lenis.start();
  }
  function initNav() {
    var nav = $("#nav"); menuEl = $("#menu"); menuBtn = $("#menuBtn");
    var last = 0;
    function onScroll() {
      var y = window.scrollY;
      nav.classList.toggle("is-scrolled", y > 24);
      if (!body.classList.contains("menu-open")) nav.classList.toggle("is-hidden", y > 520 && y > last + 4 ? true : y < last - 4 ? false : nav.classList.contains("is-hidden"));
      last = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    if (menuBtn && menuEl) {
      menuBtn.addEventListener("click", function () {
        if (menuEl.classList.contains("is-open")) return closeMenu();
        menuEl.classList.add("is-open"); menuEl.setAttribute("aria-hidden", "false");
        body.classList.add("menu-open"); menuBtn.setAttribute("aria-expanded", "true");
        menuBtn.firstElementChild.textContent = I ? I.t("nav.close") : "Cerrar";
        nav.classList.remove("is-hidden");
        if (lenis) lenis.stop();
      });
      doc.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
      window.matchMedia("(min-width: 1061px)").addEventListener("change", closeMenu);
    }
    // Sección actual resaltada en el menú
    var links = {};
    $$(".nav-links a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { var l = links[e.target.id]; if (l) l.classList.toggle("is-current", e.isIntersecting); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(links).forEach(function (id) { var s = doc.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------- Loader: carga y sale en franjas, como un corte de señal ---------- */
  function runLoader(done) {
    var loader = $("#loader"), finished = false;
    function finish() {
      if (finished) return; finished = true;
      if (loader) loader.remove(); body.classList.remove("is-loading"); if (lenis) lenis.start(); done();
    }
    setTimeout(finish, 4500);   // red de seguridad: si el navegador no anima (pestaña en segundo plano), igual se abre la página
    if (!loader) return finish();
    if (!hasGsap || reduce) return finish();
    if (lenis) lenis.stop();
    var bar = $(".ld-bar i", loader), pct = $("#ldPct"), N = 6, bands = [];
    for (var i = 0; i < N; i++) {
      var b = doc.createElement("i"); b.className = "ld-band";
      b.style.top = (i * 100 / N) + "%"; b.style.height = (100 / N + 0.3) + "%";
      loader.appendChild(b); bands.push(b);
    }
    var o = { v: 0 };
    gsap.timeline({ onComplete: finish })
      .to(o, { v: 100, duration: 1.05, ease: "power2.inOut", onUpdate: function () {
        var v = Math.round(o.v);
        pct.textContent = ("00" + v).slice(-3);
        bar.style.transform = "scaleX(" + (o.v / 100) + ")";
      } })
      .to([".ld-logo", ".ld-bar", ".ld-pct"], { opacity: 0, duration: 0.22, ease: "power1.in" }, "+=0.12")
      .set(loader, { background: "transparent" })
      .add(function () { introHero(); })
      .to(bands, { xPercent: function (i) { return i % 2 ? 101 : -101; }, duration: 0.55, ease: "steps(6)", stagger: 0.045 });
  }

  /* ---------- Hero ---------- */
  var introDone = false;
  function introHero() {
    if (introDone || !hasGsap || reduce) return;
    introDone = true;
    var tl = gsap.timeline({ defaults: { ease: "power4.out" } });
    tl.from(".hero-title .ln > span", { yPercent: 112, duration: 1.05, stagger: 0.1 }, 0.1)
      .from(".hero-eyebrow", { opacity: 0, y: 14, duration: 0.6 }, 0.15)
      .from(".hero-sub, .hero-ctas", { opacity: 0, y: 22, duration: 0.8, stagger: 0.1 }, 0.5)
      .from(".phone", { opacity: 0, y: 70, rotation: 5, duration: 1.2 }, 0.3)
      .from(".hero-ghost", { opacity: 0, xPercent: 6, duration: 1.4, ease: "power2.out" }, 0.2)
      .from(".hero-facts li", { opacity: 0, y: 12, duration: 0.6, stagger: 0.07 }, 0.8)
      .from(".nav", { yPercent: -100, duration: 0.8, clearProps: "transform" }, 0.3);
  }
  function initHero() {
    var phone = $("#phone"), hero = $("#top");
    if (!phone || !hero) return;
    // Bucle del escáner: busca → detecta → el tatuaje cobra vida
    if (reduce) { phone.classList.add("is-found"); }
    else {
      var timer = 0, active = false;
      function cycle(found) {
        phone.classList.toggle("is-found", found);
        timer = setTimeout(function () { cycle(!found); }, found ? 5400 : 2500);
      }
      function update(vis) {
        var want = vis && !doc.hidden;
        if (want && !active) { active = true; cycle(false); }
        else if (!want && active) { active = false; clearTimeout(timer); }
      }
      var seen = true;
      new IntersectionObserver(function (es) { seen = es[0].isIntersecting; update(seen); }).observe(hero);
      doc.addEventListener("visibilitychange", function () { update(seen); });
    }
    if (!hasGsap || reduce) return;
    if (fine) {
      var rx = gsap.quickTo(phone, "rotationX", { duration: 0.7, ease: "power3" });
      var ry = gsap.quickTo(phone, "rotationY", { duration: 0.7, ease: "power3" });
      hero.addEventListener("pointermove", function (e) {
        rx((e.clientY / window.innerHeight - 0.5) * -8);
        ry((e.clientX / window.innerWidth - 0.5) * 12);
      });
      hero.addEventListener("pointerleave", function () { rx(0); ry(0); });
    }
    if (hasST) {
      gsap.to(".hero-ghost", { yPercent: -28, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
      gsap.to(".hero-copy", { yPercent: -10, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
      gsap.to(".hero-demo", { yPercent: 6, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
    }
  }

  /* ---------- Cinta ---------- */
  function fillTicker() {
    var el = $("#ticker"); if (!el || !I) return;
    var words = I.t("ticker") || [], unit = "";
    words.forEach(function (w) { unit += "<span>" + w + "</span><i></i>"; });
    var half = unit + unit + unit;
    el.innerHTML = half + half;
  }

  /* ---------- Galería ---------- */
  var GAL = ["photo-1586243287039-23f4c8e2e7ab", "photo-1604374376934-2df6fad6519b", "photo-1601848714157-d845bb5c11ff", "photo-1568515045052-f9a854d70bfd",
    "photo-1597852075234-fd721ac361d3", "photo-1565058379802-bbe93b2f703a", "photo-1605647533135-51b5906087d0", "photo-1583213261205-63258746ed4c"];
  function fillGallery() {
    var a = $("#galA"), b = $("#galB"); if (!a || !b) return;
    var names = (I && I.t("gal.styles")) || [], found = I ? I.t("scan.found") : "Tatuaje detectado";
    function card(id, i) {
      return '<figure class="gal-card"><img src="https://images.unsplash.com/' + id + '?auto=format&fit=crop&w=540&h=675&q=70" alt="" loading="lazy" decoding="async" width="540" height="675">' +
        '<i class="tar-vf"></i><figcaption class="gal-meta"><b>' + (names[i] || "") + '</b><span class="tar-label">' + found + "</span></figcaption></figure>";
    }
    function row(from) { var h = ""; for (var i = from; i < from + 4; i++) h += card(GAL[i], i); return h + h + h + h; }
    a.innerHTML = row(0); b.innerHTML = row(4);
  }

  /* ---------- Entradas al hacer scroll ---------- */
  function initReveals() {
    var steps = $$(".step");
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
      }, { rootMargin: "0px 0px -12% 0px" });
      steps.forEach(function (s) { io.observe(s); });
    } else steps.forEach(function (s) { s.classList.add("is-in"); });
    if (!hasST || reduce) return;
    var groups = [".sec-head > *", ".step", ".demo-flash", ".demo-copy > *", ".alive-cap, .alive-hint", ".role", ".cell", ".stats > div",
      ".use", ".plan", ".plans-note", ".qa", ".cta-copy > *", ".ink-wrap", ".foot-grid > *"];
    groups.forEach(function (sel) {
      var els = $$(sel);
      if (!els.length) return;
      gsap.set(els, { opacity: 0, y: 28 });
      ScrollTrigger.batch(els, {
        start: "top 90%", once: true,
        onEnter: function (batch) { gsap.to(batch, { opacity: 1, y: 0, duration: 0.85, ease: "power3.out", stagger: 0.08, overwrite: true, clearProps: "transform" }); }
      });
    });
    // El flash "se enfoca": el visor se ajusta al entrar
    gsap.from(".flash-card .tar-vf", { inset: "-46px", opacity: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: ".flash-card", start: "top 78%", once: true } });
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  }

  /* ---------- Contadores ---------- */
  function initStats() {
    var nums = $$("#stats [data-count]");
    if (!nums.length || !hasST || reduce) return;
    nums.forEach(function (el) {
      var to = +el.getAttribute("data-count"), o = { v: to === 0 ? 9 : 0 };
      el.textContent = Math.round(o.v);
      gsap.to(o, { v: to, duration: 1.3, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 92%", once: true },
        onUpdate: function () { el.textContent = Math.round(o.v); } });
    });
  }

  /* ---------- FAQ: abre y cierra con altura animada ---------- */
  function initFaq() {
    $$(".qa").forEach(function (qa) {
      var sum = $("summary", qa), panel = $(".qa-a", qa), anim = null;
      if (!sum || !panel || reduce || !panel.animate) return;
      sum.addEventListener("click", function (e) {
        e.preventDefault();
        if (anim) anim.cancel();
        var opening = !qa.open, from, to;
        if (opening) { qa.open = true; from = 0; to = panel.scrollHeight; }
        else { from = panel.offsetHeight; to = 0; }
        anim = panel.animate({ height: [from + "px", to + "px"] }, { duration: 380, easing: "cubic-bezier(.22,1,.36,1)" });
        anim.onfinish = function () { if (!opening) qa.open = false; anim = null; if (hasST) ScrollTrigger.refresh(); };
      });
    });
  }

  /* ---------- "Tinta viva": letras góticas hechas de puntos que reaccionan ---------- */
  function initParticleText() {
    var cv = $("#ptext"); if (!cv) return;
    var ctx = cv.getContext("2d"), DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, parts = [], mouse = { x: -9999, y: -9999 }, ink = "#f2f0eb", lime = "#c8f560";
    var glitch = { until: 0, y: 0, h: 0, dx: 0, next: 0, color: lime };
    function colors() {
      var cs = getComputedStyle(root);
      ink = cs.getPropertyValue("--cream").trim() || ink;
      lime = root.getAttribute("data-theme") === "light" ? "#3f6606" : "#c8f560";
    }
    function build() {
      W = cv.clientWidth; H = cv.clientHeight;
      if (!W || !H) return;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var text = "Tinta viva", size = Math.min(H * 0.92, W / 4.6);
      var off = doc.createElement("canvas"); off.width = W; off.height = H;
      var o = off.getContext("2d");
      o.fillStyle = "#000"; o.textAlign = "center"; o.textBaseline = "middle";
      o.font = "800 " + size + "px 'Grenze Gotisch', 'UnifrakturMaguntia', serif";
      o.fillText(text, W / 2, H / 2 + size * 0.04);
      var data = o.getImageData(0, 0, W, H).data, gap = W < 640 ? 4 : W < 1100 ? 5 : 6;
      parts = [];
      for (var y = 0; y < H; y += gap) for (var x = 0; x < W; x += gap) {
        if (data[(y * W + x) * 4 + 3] > 128) parts.push({ x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 60, hx: x, hy: y, vx: 0, vy: 0 });
      }
      cv.__size = Math.max(2, gap - 2.5);
    }
    function frame(t) {
      ctx.clearRect(0, 0, W, H);
      var R = fine ? 96 : 70, R2 = R * R, s = cv.__size || 2, i, p, dx, dy, d2, f;
      if (!reduce && t > glitch.next) {           // corte de señal: una franja se desplaza 90 ms
        glitch.until = t + 90; glitch.next = t + 2600 + Math.random() * 1500;
        glitch.h = H * (0.05 + Math.random() * 0.06); glitch.y = H * 0.2 + Math.random() * H * 0.55;
        glitch.dx = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 10);
        glitch.color = ["#c8f560", "#2ee6ff", "#ff2e88"][Math.floor(Math.random() * 3)];
      }
      var cut = t < glitch.until;
      ctx.fillStyle = ink;
      var hot = [];
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        dx = p.x - mouse.x; dy = p.y - mouse.y; d2 = dx * dx + dy * dy;
        if (d2 < R2) { f = (1 - d2 / R2) * 2.2; var d = Math.sqrt(d2) || 1; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
        p.vx += (p.hx - p.x) * 0.06; p.vy += (p.hy - p.y) * 0.06;
        p.vx *= 0.82; p.vy *= 0.82; p.x += p.vx; p.y += p.vy;
        var moved = Math.abs(p.x - p.hx) + Math.abs(p.y - p.hy) > 3;
        if (cut && p.hy > glitch.y && p.hy < glitch.y + glitch.h) { hot.push(p.x + glitch.dx, p.y, 1); continue; }
        if (moved) { hot.push(p.x, p.y, 0); continue; }
        ctx.fillRect(p.x, p.y, s, s);
      }
      for (i = 0; i < hot.length; i += 3) { ctx.fillStyle = hot[i + 2] ? glitch.color : lime; ctx.fillRect(hot[i], hot[i + 1], s, s); }
    }
    function pos(e) { var r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; }
    cv.addEventListener("pointermove", pos);
    cv.addEventListener("pointerdown", pos);
    cv.addEventListener("pointerleave", function () { mouse.x = mouse.y = -9999; });
    var rt = 0;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (cv.clientWidth !== W) build(); }, 180); });
    new MutationObserver(colors).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    colors();
    var start = function () { build(); if (reduce) frame(0); else whileVisible(cv, frame, "100px"); };
    if (doc.fonts && doc.fonts.load) doc.fonts.load("800 100px 'Grenze Gotisch'").then(start, start); else start();
  }

  /* ---------- QR de la demo (se carga solo cuando hace falta) ---------- */
  function initQr() {
    var demo = $("#demoQr"), sticker = $("#stickerQr");
    if (!demo && !sticker) return;
    var url = new URL("scan.html?t=demo", location.href).href, loaded = false;
    function draw() {
      if (!window.QRCode) return;
      [[demo, 296], [sticker, 180]].forEach(function (p) {
        if (!p[0]) return;
        p[0].innerHTML = "";
        new window.QRCode(p[0], { text: url, width: p[1], height: p[1], colorDark: "#0b0b0b", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M });
        p[0].removeAttribute("title");
      });
    }
    function load() {
      if (loaded) return; loaded = true;
      var s = doc.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.async = true; s.onload = draw;
      doc.head.appendChild(s);
    }
    var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); load(); } }, { rootMargin: "800px 0px" });
    [demo, sticker].forEach(function (el) { if (el) io.observe(el); });
  }

  /* ---------- Botones magnéticos (solo puntero fino) ---------- */
  function initMagnetic() {
    if (!hasGsap || !fine || reduce) return;
    $$(".hero-ctas .btn").forEach(function (btn) {
      var x = gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3" }), y = gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3" });
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.22); y((e.clientY - (r.top + r.height / 2)) * 0.32);
      });
      btn.addEventListener("pointerleave", function () { x(0); y(0); });
    });
  }

  /* ---------- Barrido lateral al pasar al escáner / estudio ---------- */
  function initWipe() {
    var wipe = $("#page-wipe"); if (!wipe) return;
    if (!hasGsap || reduce) return;
    var logo = $("[data-ta-logo]", wipe);
    gsap.set(wipe, { x: 0, xPercent: 101 });
    $$("a[data-wipe]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        var href = a.getAttribute("href");
        gsap.timeline({ onComplete: function () { location.href = href; } })
          .to(wipe, { xPercent: 0, duration: 0.55, ease: "power4.inOut" })
          .fromTo(logo, { opacity: 0, x: 22 }, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" }, "-=0.2")
          .to({}, { duration: 0.28 });
      });
    });
    window.addEventListener("pageshow", function (e) { if (e.persisted) { gsap.set(wipe, { xPercent: 101 }); gsap.set(logo, { opacity: 0 }); } });
  }

  /* ---------- Arranque ---------- */
  function boot() {
    initPrefs();
    fillTicker(); fillGallery();
    doc.addEventListener("ta:lang", function () { fillTicker(); fillGallery(); closeMenuLabel(); });
    initScroll(); initNav(); initHero();
    runLoader(function () { introHero(); });
    initReveals(); initStats(); initFaq(); initParticleText(); initQr(); initMagnetic(); initWipe();
  }
  function closeMenuLabel() {
    if (menuBtn && I) menuBtn.firstElementChild.textContent = I.t(menuEl && menuEl.classList.contains("is-open") ? "nav.close" : "nav.menu");
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})();
