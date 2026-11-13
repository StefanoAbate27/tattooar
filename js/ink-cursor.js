/* Tattoo AR — cursor "máquina de tatuaje": aguja que vibra + rastro de tinta. */
(function () {
  "use strict";
  var fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine) return; // en móvil/touch no aplica

  var canvas = document.createElement("canvas");
  canvas.className = "ink-canvas";
  var nib = document.createElement("div");
  nib.className = "ink-nib";
  nib.innerHTML = '<span class="ink-needle"></span><span class="ink-dot"></span>';
  document.addEventListener("DOMContentLoaded", mount);
  if (document.readyState !== "loading") mount();
  function mount() {
    if (canvas.parentNode) return;
    document.body.appendChild(canvas);
    document.body.appendChild(nib);
    document.body.classList.add("ink-on");
    resize();
  }

  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
  function resize() { W = canvas.width = innerWidth * dpr; H = canvas.height = innerHeight * dpr; canvas.style.width = innerWidth + "px"; canvas.style.height = innerHeight + "px"; }
  window.addEventListener("resize", resize);

  function inkColor() {
    var c = getComputedStyle(document.documentElement).getPropertyValue("--green").trim();
    return c || "#c8f560";
  }

  var pts = [];            // rastro de tinta: {x,y,t,w}
  var mx = -100, my = -100, px = mx, py = my, down = false, moving = 0;
  window.addEventListener("pointermove", function (e) {
    var nx = e.clientX, ny = e.clientY;
    var d = Math.hypot(nx - px, ny - py);
    moving = Math.min(1, d / 14);
    // ancho del trazo según velocidad (como presión de la aguja)
    var w = (down ? 3.4 : 2.2) + Math.min(4, d * 0.14);
    pts.push({ x: nx, y: ny, t: performance.now(), w: w });
    if (pts.length > 90) pts.shift();
    mx = nx; my = ny; px = nx; py = ny;
  }, { passive: true });
  window.addEventListener("pointerdown", function () { down = true; });
  window.addEventListener("pointerup", function () { down = false; });
  window.addEventListener("pointerleave", function () { mx = my = -100; });

  var LIFE = 420; // ms
  function frame() {
    ctx.clearRect(0, 0, W, H);
    var now = performance.now();
    var col = inkColor();
    // rastro
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      var age = now - b.t; if (age > LIFE) continue;
      var alpha = (1 - age / LIFE);
      ctx.strokeStyle = col;
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = b.w * dpr * alpha;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(a.x * dpr, a.y * dpr);
      ctx.lineTo(b.x * dpr, b.y * dpr);
      ctx.stroke();
    }
    // punto de tinta (nib glow)
    if (mx > -50) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = col;
      var jitter = reduce ? 0 : (Math.random() - 0.5) * 1.6;
      ctx.beginPath();
      ctx.arc((mx + jitter) * dpr, (my + jitter) * dpr, 2.4 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // nib (aguja) sigue el puntero con vibración de máquina
    var vib = reduce ? 0 : (Math.random() - 0.5) * (2 + moving * 3);
    nib.style.transform = "translate(" + (mx) + "px," + (my + vib) + "px)";
    nib.style.opacity = mx > -50 ? "1" : "0";
    moving *= 0.9;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
