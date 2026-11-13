/* Tattoo AR — animaciones de entrada y microinteracciones (GSAP) para generador y escáner */
(function () {
  "use strict";
  if (typeof gsap === "undefined") return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var EASE = "power3.out";

  function run(fn) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); }

  // Revela sin dejar elementos "pegados" en opacidad 0 (si la pestaña está oculta, muestra directo).
  function reveal(target, vars) {
    var els = typeof target === "string" ? document.querySelectorAll(target) : target;
    if (!els || (els.length === 0 && !els.nodeType)) return;
    if (reduce || document.hidden) { gsap.set(target, { clearProps: "all" }); return; }
    var from = Object.assign({}, vars);
    from.duration = vars.duration || 0.6;
    from.ease = vars.ease || EASE;
    from.clearProps = "opacity,transform,x,y,scale";
    gsap.from(target, from);
  }

  run(function () {
    reveal(".topbar, .app-controls", { y: -14, opacity: 0, duration: 0.6 });

    /* ---------- GENERADOR ---------- */
    if (document.querySelector(".studio")) {
      reveal(".studio-hero > *", { y: 20, opacity: 0, duration: 0.7, stagger: 0.08 });
      reveal(".studio-preview", { x: -24, opacity: 0, duration: 0.7, delay: 0.15 });
      reveal(".studio-panel > *", { y: 18, opacity: 0, duration: 0.6, stagger: 0.06, delay: 0.12 });
      reveal(".effect-btn", { scale: 0.9, opacity: 0, duration: 0.4, ease: "back.out(1.5)", stagger: 0.05, delay: 0.35 });

      var result = document.getElementById("result");
      if (result) {
        new MutationObserver(function () {
          if (!result.classList.contains("hidden") && !result.dataset.shown) {
            result.dataset.shown = "1";
            if (!reduce && !document.hidden) gsap.from(result, { y: 20, opacity: 0, duration: 0.6, ease: EASE, clearProps: "opacity,transform" });
          }
        }).observe(result, { attributes: true, attributeFilter: ["class"] });
      }
      var effects = document.getElementById("effects");
      if (effects) effects.addEventListener("click", function (e) {
        var b = e.target.closest(".effect-btn");
        if (b && !reduce) gsap.fromTo(b, { scale: 0.94 }, { scale: 1, duration: 0.3, ease: "back.out(2)", clearProps: "transform" });
      });
      ["ct-effect", "ct-video"].forEach(function (id) {
        var t = document.getElementById(id);
        if (t) t.addEventListener("click", function () {
          if (reduce) return;
          var pane = id === "ct-effect" ? document.getElementById("pane-effect") : document.getElementById("pane-video");
          if (pane) gsap.fromTo(pane, { y: 8, opacity: 0.4 }, { y: 0, opacity: 1, duration: 0.4, ease: EASE, clearProps: "opacity,transform" });
        });
      });
    }

    /* ---------- ESCÁNER ---------- */
    var card = document.querySelector("#intro .card");
    if (card) {
      reveal(card.children, { y: 18, opacity: 0, duration: 0.6, stagger: 0.09, delay: 0.1 });
      if (!reduce && !document.hidden) gsap.to("#intro .logo", { scale: 1.015, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.2 });
      var scanning = document.getElementById("scanning");
      if (scanning) {
        new MutationObserver(function () {
          if (!scanning.classList.contains("hidden") && !scanning.dataset.shown) {
            scanning.dataset.shown = "1";
            if (!reduce && !document.hidden) gsap.from(".scan-pill", { y: 14, opacity: 0, duration: 0.5, ease: "back.out(1.6)", clearProps: "opacity,transform" });
          } else if (scanning.classList.contains("hidden")) { scanning.dataset.shown = ""; }
        }).observe(scanning, { attributes: true, attributeFilter: ["class"] });
      }
    }

    // Red de seguridad: nada queda invisible tras 1.4s.
    setTimeout(function () {
      document.querySelectorAll(".studio-panel > *, .effect-btn, .studio-preview, #intro .card > *").forEach(function (el) {
        if (parseFloat(getComputedStyle(el).opacity) < 0.98) gsap.set(el, { clearProps: "all" });
      });
    }, 1400);
  });
})();
