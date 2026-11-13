/* Tattoo AR — saludo de bienvenida que se reproduce SOBRE el destino ya cargado
   (dashboard o generador) y al deslizar hacia arriba revela la página detrás. */
(function () {
  "use strict";
  var raw = null;
  try { raw = sessionStorage.getItem("ta:welcome"); } catch (e) {}
  if (!raw) return;
  try { sessionStorage.removeItem("ta:welcome"); } catch (e) {}
  var data; try { data = JSON.parse(raw); } catch (e) { data = { name: raw }; }
  var name = (data && data.name) || "";
  var GREETINGS = ["Hola", "Hello", "Ciao", "Bonjour", "Olá", "こんにちは"];

  function build() {
    var ov = document.createElement("div");
    ov.className = "greet";
    ov.id = "welcome-ov";
    ov.innerHTML =
      '<div class="greet-inner">' +
        '<div id="w-words" class="words-pre"><p class="words-line"><span class="words-dot"></span><span class="wp-word">Hola</span></p></div>' +
        '<div id="w-flap-wrap" class="greet-flap" hidden><div class="greet-hola">HOLA</div><div id="w-flap"></div><div class="greet-hint">Abriendo tu estudio…</div></div>' +
      '</div>';
    document.body.appendChild(ov);
    return ov;
  }
  function mountFlap(id, txt) {
    var t = (txt || "TATUADOR").toUpperCase().slice(0, 14);
    function go() {
      window.TASplitFlap.mount(document.getElementById(id), {
        words: ["", t], loop: false, cycleDelay: 280, flipsPerChar: 10, stagger: 0.04,
        charset: "alpha", fontSize: 40, tileColor: "#1a1a19", textColor: "#c8f560", tileRadius: 3, gap: 5, padTo: Math.max(t.length, 5)
      });
    }
    if (window.TASplitFlap) go(); else window.addEventListener("ta-splitflap-ready", go, { once: true });
  }
  function run() {
    var ov = build();
    var wt = ov.querySelector(".wp-word"), words = ov.querySelector("#w-words"), wrap = ov.querySelector("#w-flap-wrap");
    var done = false;
    var finish = function () { if (done) return; done = true; ov.remove(); };
    setTimeout(function () { if (!done) finish(); }, 12000); // red de seguridad
    if (typeof gsap === "undefined") { setTimeout(finish, 400); return; }
    var tl = gsap.timeline();
    GREETINGS.forEach(function (w, idx) {
      tl.to(wt, { duration: 0.09, opacity: 0, y: -10, ease: "power1.in", onComplete: function () { wt.textContent = w; } }, idx === 0 ? 0.12 : "+=0.12")
        .fromTo(wt, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" });
    });
    tl.add(function () {
      words.hidden = true; wrap.hidden = false;
      gsap.from(wrap, { y: 18, opacity: 0, duration: 0.4, ease: "power3.out" });
      mountFlap("w-flap", name);
    }, "+=0.1");
    // Espera a que TERMINE el flip del nombre (~2s) + un breve respiro, y luego desliza.
    tl.to(ov, { yPercent: -100, borderBottomLeftRadius: "50% 26%", borderBottomRightRadius: "50% 26%", duration: 0.8, ease: "power3.inOut", delay: 2.7, onComplete: finish });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
