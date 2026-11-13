/* Tattoo AR — CTA: máquina de tatuar 3D inalámbrica e interactiva (Three.js + Web Audio).
   - La punta sigue al cursor/dedo; mantener el clic = más presión (línea gruesa, sonido grave).
   - Batería con pantalla de voltaje en vivo y anillo LED de estado.
   - Zumbido sintetizado de máquina de tatuar (sin archivos de audio), activable/desactivable.
   - Selector de color de tinta; la tinta "cobra vida" y se desvanece.
   - Sin interacción, tatúa sola el logo oficial sobre la piel y lo muestra cicatrizado. Three.js se carga en diferido y el loop
     solo corre con la sección visible. */
(function () {
  "use strict";
  var stage = document.getElementById("ink-stage");
  if (!stage) return;
  var THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function loadThree(cb) {
    if (window.THREE) return cb();
    var s = document.createElement("script");
    s.src = THREE_URL; s.async = true;
    s.onload = cb;
    s.onerror = function () { stage.classList.add("no-gl"); };
    document.head.appendChild(s);
  }
  var lazy = new IntersectionObserver(function (es) {
    if (es[0].isIntersecting) { lazy.disconnect(); loadThree(init); }
  }, { rootMargin: "600px 0px" });
  lazy.observe(stage);

  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function hexRgb(h) {
    h = (h || "").replace("#", "");
    if (h.length === 3) h = h.replace(/./g, "$&$&");
    var n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function damp(cur, to, k, dt) { return cur + (to - cur) * (1 - Math.exp(-dt * k)); }

  // ================= Sonido: zumbido de máquina de tatuar (Web Audio) =================
  var Buzz = (function () {
    var ctx = null, nodes = null, enabled = true;
    try { enabled = localStorage.getItem("ta:ink-sound") !== "off"; } catch (e) {}
    function curve(k) {
      var n = 1024, c = new Float32Array(n);
      for (var i = 0; i < n; i++) { var x = (i * 2) / n - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
      return c;
    }
    function build() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      var master = ctx.createGain(); master.gain.value = 0;
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3400; lp.Q.value = 0.8;
      var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 65;
      var shaper = ctx.createWaveShaper(); shaper.curve = curve(7); shaper.oversample = "2x";
      shaper.connect(lp); lp.connect(hp); hp.connect(master); master.connect(ctx.destination);
      // Motor/bobina: diente de sierra + cuadrada ligeramente desafinada → el "bzzzz" clásico
      var o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = 128;
      var o2 = ctx.createOscillator(); o2.type = "square"; o2.frequency.value = 257;
      var g1 = ctx.createGain(); g1.gain.value = 0.55;
      var g2 = ctx.createGain(); g2.gain.value = 0.14;
      o1.connect(g1); g1.connect(shaper); o2.connect(g2); g2.connect(shaper);
      // Traqueteo mecánico: ruido filtrado, abierto/cerrado a la frecuencia de la aguja
      var len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2600; bp.Q.value = 1.1;
      var gate = ctx.createGain(); gate.gain.value = 0.16;
      var lfo = ctx.createOscillator(); lfo.type = "square"; lfo.frequency.value = 128;
      var lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.16;
      lfo.connect(lfoAmt); lfoAmt.connect(gate.gain);
      noise.connect(bp); bp.connect(gate); gate.connect(lp);
      o1.start(); o2.start(); noise.start(); lfo.start();
      nodes = { master: master, lp: lp, o1: o1, o2: o2, lfo: lfo };
      return true;
    }
    return {
      get enabled() { return enabled; },
      // Solo arranca tras un gesto del usuario (política de autoplay)
      wake: function (gesture) {
        if (!enabled) return;
        var active = gesture || (navigator.userActivation && navigator.userActivation.hasBeenActive);
        if (!active) return;
        if (!ctx && !build()) return;
        if (ctx.state === "suspended") ctx.resume();
      },
      toggle: function () {
        enabled = !enabled;
        try { localStorage.setItem("ta:ink-sound", enabled ? "on" : "off"); } catch (e) {}
        if (enabled) this.wake(true); else this.set(0, 130, 3400);
        return enabled;
      },
      set: function (vol, freq, cutoff) {
        if (!ctx || !nodes) return;
        var t = ctx.currentTime;
        nodes.master.gain.setTargetAtTime(enabled ? vol : 0, t, 0.04);
        var f = freq * (1 + (Math.random() - 0.5) * 0.012);
        nodes.o1.frequency.setTargetAtTime(f, t, 0.03);
        nodes.o2.frequency.setTargetAtTime(f * 2.008, t, 0.03);
        nodes.lfo.frequency.setTargetAtTime(f, t, 0.03);
        nodes.lp.frequency.setTargetAtTime(cutoff, t, 0.05);
      },
      sleep: function () {
        if (!ctx) return;
        this.set(0, 130, 3400);
        setTimeout(function () { if (ctx && ctx.state === "running") ctx.suspend(); }, 250);
      }
    };
  })();

  function init() {
    var T = window.THREE;
    var glCv = stage.querySelector(".gl-canvas");
    var inkCv = stage.querySelector(".ink-canvas");
    var ictx = inkCv.getContext("2d");
    var renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: glCv, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) { stage.classList.add("no-gl"); return; }
    var DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(DPR);
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 12);

    // Estudio procedural para reflejos metálicos (sin descargar HDRs)
    var pmrem = new T.PMREMGenerator(renderer);
    var env = new T.Scene();
    env.add(new T.Mesh(new T.BoxGeometry(20, 20, 20), new T.MeshBasicMaterial({ color: 0x161616, side: T.BackSide })));
    function panel(w, h, x, y, z, c, k) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(k), side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    }
    panel(9, 3, 0, 8, 4, 0xffffff, 3);
    panel(3, 9, -9, 1, 3, 0xffffff, 1.6);
    panel(3, 9, 9, 0, -2, 0xc8f560, 1.1);
    scene.environment = pmrem.fromScene(env, 0.04).texture;

    scene.add(new T.HemisphereLight(0xffffff, 0x1a1a1a, 0.5));
    var key = new T.DirectionalLight(0xffffff, 1.5); key.position.set(-4, 6, 8); scene.add(key);
    var rim = new T.PointLight(0xc8f560, 2.6, 22); rim.position.set(4, 2, -3); scene.add(rim);

    // ---------- Materiales ----------
    var matBody = new T.MeshStandardMaterial({ color: 0x151515, metalness: 0.8, roughness: 0.3 });
    var matBattery = new T.MeshStandardMaterial({ color: 0x242424, metalness: 0.55, roughness: 0.42 });
    var matGrip = new T.MeshStandardMaterial({ color: 0x1c1c1c, metalness: 0.15, roughness: 0.75 });
    var matSteel = new T.MeshStandardMaterial({ color: 0xdedede, metalness: 1, roughness: 0.16 });
    var matAccent = new T.MeshStandardMaterial({ color: 0xc8f560, emissive: 0xc8f560, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.4 });
    var matLed = new T.MeshBasicMaterial({ color: 0xc8f560, toneMapped: false });
    var matCart = new T.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.3, clearcoat: 1, depthWrite: false });
    var matInk = new T.MeshStandardMaterial({ color: 0xc8f560, emissive: 0xc8f560, emissiveIntensity: 0.35, roughness: 0.3 });

    // Pantalla de la batería (textura de canvas con el voltaje)
    var dispCv = document.createElement("canvas"); dispCv.width = 256; dispCv.height = 160;
    var dctx = dispCv.getContext("2d");
    var dispTex = new T.CanvasTexture(dispCv); dispTex.encoding = T.sRGBEncoding;
    var matDisplay = new T.MeshBasicMaterial({ map: dispTex, toneMapped: false });

    // ---------- Máquina "pen" inalámbrica (punta en el origen, apunta a -Y) ----------
    var pen = new T.Group();
    function lathe(pts, mat) {
      var m = new T.Mesh(new T.LatheGeometry(pts.map(function (p) { return new T.Vector2(p[0], p[1]); }), 56), mat);
      pen.add(m); return m;
    }
    function cyl(r, h, y, mat, rb) {
      var m = new T.Mesh(new T.CylinderGeometry(r, rb == null ? r : rb, h, 48), mat);
      m.position.y = y; pen.add(m); return m;
    }
    function torus(r, tube, y, mat) {
      var m = new T.Mesh(new T.TorusGeometry(r, tube, 8, 56), mat);
      m.rotation.x = Math.PI / 2; m.position.y = y; pen.add(m); return m;
    }
    var needle = new T.Mesh(new T.CylinderGeometry(0.014, 0.004, 0.9, 12), matSteel);
    needle.position.y = 0.45; pen.add(needle);
    cyl(0.085, 0.55, 0.85, matInk);                                   // tinta dentro del cartucho
    lathe([[0.02, 0.1], [0.06, 0.13], [0.1, 0.3], [0.16, 0.55], [0.19, 0.95], [0.2, 1.25], [0.01, 1.25]], matCart);
    cyl(0.26, 1.15, 1.8, matGrip);                                    // grip
    for (var i = 0; i < 10; i++) torus(0.262, 0.017, 1.32 + i * 0.105, matGrip); // moleteado
    cyl(0.285, 0.07, 2.42, matAccent);                                // anillo de acento
    cyl(0.3, 0.1, 2.52, matSteel);                                    // ajuste de carrera
    lathe([[0.01, 2.56], [0.29, 2.56], [0.3, 2.62], [0.3, 3.9], [0.01, 3.9]], matBody); // motor
    torus(0.301, 0.007, 3.1, matSteel);
    cyl(0.306, 0.08, 3.94, matSteel);                                 // acople de la batería
    var ledRing = torus(0.312, 0.016, 4.0, matLed);                   // anillo LED de estado
    lathe([[0.01, 4.02], [0.32, 4.02], [0.335, 4.08], [0.335, 4.98], [0.315, 5.07], [0.25, 5.14], [0.01, 5.16]], matBattery);
    for (var k = 0; k < 3; k++) torus(0.336, 0.006, 4.82 + k * 0.05, matSteel);
    var bezel = new T.Mesh(new T.CylinderGeometry(0.338, 0.338, 0.3, 24, 1, true, -0.66, 1.32), matBody);
    bezel.position.y = 4.45; pen.add(bezel);
    var screen = new T.Mesh(new T.CylinderGeometry(0.341, 0.341, 0.235, 24, 1, true, -0.58, 1.16), matDisplay);
    screen.position.y = 4.45; pen.add(screen);
    var btn = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.06, 20), matSteel);   // botón de encendido
    btn.rotation.z = Math.PI / 2; btn.position.set(-0.345, 4.62, 0); pen.add(btn);
    var btnLed = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.065, 12), matLed);
    btnLed.rotation.z = Math.PI / 2; btnLed.position.set(-0.35, 4.62, 0); pen.add(btnLed);

    var rig = new T.Group();
    rig.add(pen);
    scene.add(rig);

    // ---------- Colores según tema + tinta elegida ----------
    var INKS = { green: "--green", pink: "--pink", blue: "--blue", orange: "--orange", lilac: "--lilac" };
    var inkKey = "green", inkBase, inkLive, accentHex = "#c8f560", accentRgb = [200, 245, 96];
    function applyTheme() {
      var light = document.documentElement.getAttribute("data-theme") === "light";
      accentHex = cssVar("--green") || "#c8f560";
      var inkHex = cssVar(INKS[inkKey]) || accentHex;
      inkBase = [16, 17, 20];                 // tinta de tatuaje sobre la piel del escenario
      inkLive = hexRgb(inkHex);
      accentRgb = hexRgb(accentHex);
      matAccent.color.set(accentHex); matAccent.emissive.set(accentHex);
      matInk.color.set(inkHex); matInk.emissive.set(inkHex);
      rim.color.set(light ? 0xffffff : accentHex);
      renderer.toneMappingExposure = light ? 1.2 : 1.05;
      lastVolt = -1;
    }

    // ---------- Pantalla de voltaje ----------
    var lastVolt = -1, battery = 0.92;
    function drawDisplay(v, on) {
      var r = Math.round(v * 10);
      if (r === lastVolt) return;
      lastVolt = r;
      dctx.fillStyle = "#060706"; dctx.fillRect(0, 0, 256, 160);
      dctx.fillStyle = on ? accentHex : "#3a3d36";
      dctx.textAlign = "right"; dctx.textBaseline = "alphabetic";
      dctx.font = "600 86px 'Space Grotesk', system-ui, sans-serif";
      dctx.fillText((r / 10).toFixed(1), 196, 104);
      dctx.font = "600 38px 'Space Grotesk', system-ui, sans-serif";
      dctx.textAlign = "left"; dctx.fillText("V", 202, 104);
      for (var b = 0; b < 5; b++) {                                    // nivel de batería
        dctx.globalAlpha = b / 5 < battery ? 1 : 0.22;
        dctx.fillRect(66 + b * 26, 128, 20, 12);
      }
      dctx.globalAlpha = 1;
      dispTex.needsUpdate = true;
    }
    applyTheme();
    new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    // ---------- Demo automático: la máquina tatúa el logo oficial y lo cicatriza ----------
    // Usa la geometría real del logo (js/brand-logo.js): "Tattoo" gótico + bloque "AR_".
    // Fases como en el estudio: delineado → relleno → color → cicatrización (día 1 a 14) → sanado.
    var LG = window.taLogo && window.taLogo.paths, logo = null;
    var PH = { approach: 0.6, jump: 0.12, line: 5.2, fill: 2.3, boxLine: 0.6, boxFill: 1.0, ar: 0.9, heal: 2.8, hold: 2.6, fade: 0.8, rest: 0.5 };
    function buildLogo() {
      if (!LG || !document.createElementNS) return null;
      var NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
      svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
      svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden";
      document.body.appendChild(svg);
      // Cada contorno de la palabra se recorre por separado (se parte en cada "M" absoluto).
      var subs = [];
      LG.word.split(/(?=M)/).forEach(function (d) {
        var p = document.createElementNS(NS, "path"); p.setAttribute("d", d); svg.appendChild(p);
        var len = p.getTotalLength(); if (!len) return;
        var n = Math.max(8, Math.ceil(len / 1.4)), pts = [], cum = [];
        for (var i = 0; i <= n; i++) { var q = p.getPointAtLength((len * i) / n); pts.push(q.x, q.y); cum.push((len * i) / n); }
        subs.push({ pts: pts, cum: cum, len: len });
      });
      svg.remove();
      var total = subs.reduce(function (a, s) { return a + s.len; }, 0);
      var b = LG.block;
      // Línea de tiempo: [inicio, fin] de cada fase, en segundos.
      var steps = [], t = PH.approach;
      subs.forEach(function (s, i) {
        if (i) { steps.push({ k: "jump", from: i - 1, to: i, t0: t, t1: t + PH.jump }); t += PH.jump; }
        var d = PH.line * (s.len / total);
        steps.push({ k: "line", sub: i, t0: t, t1: t + d }); t += d;
      });
      var mark = function (k, d) { steps.push({ k: k, t0: t, t1: t + d }); t += d; };
      mark("fill", PH.fill); mark("boxLine", PH.boxLine); mark("boxFill", PH.boxFill); mark("ar", PH.ar);
      mark("heal", PH.heal); mark("hold", PH.hold); mark("fade", PH.fade); mark("rest", PH.rest);
      return {
        subs: subs, steps: steps, cycle: t, box: b,
        word: new Path2D(LG.word), ar: new Path2D(LG.ar),
        bounds: { x0: 0, x1: b.x + b.w, y0: -64, y1: 1.5 }
      };
    }
    // Grano de piel: puntos claros que se ven a través de la tinta cicatrizada.
    function makeGrain() {
      var c = document.createElement("canvas"); c.width = c.height = 96;
      var g = c.getContext("2d"), img = g.createImageData(96, 96);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = Math.random();
        img.data[i] = 214; img.data[i + 1] = 172; img.data[i + 2] = 150;
        img.data[i + 3] = v > 0.86 ? 150 : v > 0.7 ? 60 : 0;
      }
      g.putImageData(img, 0, 0);
      return c;
    }
    var grainCanvas = makeGrain(), grain = null;
    var lc = document.createElement("canvas"), lctx = lc.getContext("2d");   // capa del logo
    var LK = 1, LX = 0, LY = 0;                                               // logo → pantalla (px CSS)
    function placeLogo() {
      if (!logo) return;
      var bw = logo.bounds.x1 - logo.bounds.x0, bh = logo.bounds.y1 - logo.bounds.y0;
      // Centrado en el espacio libre: a la izquierda están los colores de tinta (en celular van abajo).
      var sw = stage.querySelector(".ink-swatches"), side = sw && getComputedStyle(sw).flexDirection === "column";
      var left = side ? 76 : 18, right = side ? 40 : 18, free = W - left - right;
      LK = Math.min((free * 0.9) / bw, (H * 0.3) / bh);
      LX = left + (free - bw * LK) / 2;
      LY = H * 0.55 + (bh * LK) / 2 - logo.bounds.y1 * LK;
      lc.width = inkCv.width; lc.height = inkCv.height;
    }
    // Punto del logo (unidades del SVG) → mundo 3D, para llevar la punta de la máquina ahí.
    function logoToWorld(u, v, out) {
      var sx = LX + u * LK, sy = LY + v * LK;
      return out.set((sx / W - 0.5) * 2 * hw, -(sy / H - 0.5) * 2 * hh, 0);
    }
    function subPoint(s, len) {
      var c = s.cum, i = 1;
      while (i < c.length - 1 && c[i] < len) i++;
      var f = clamp((len - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1]), 0, 1), p = s.pts;
      return [p[(i - 1) * 2] + (p[i * 2] - p[(i - 1) * 2]) * f, p[(i - 1) * 2 + 1] + (p[i * 2 + 1] - p[(i - 1) * 2 + 1]) * f];
    }
    function rectPoint(b, f) {                       // recorre el borde del bloque AR
      var per = 2 * (b.w + b.h), d = f * per;
      if (d < b.w) return [b.x + d, b.y];
      if ((d -= b.w) < b.h) return [b.x + b.w, b.y + d];
      if ((d -= b.h) < b.w) return [b.x + b.w - d, b.y + b.h];
      return [b.x, b.y + b.h - (d - b.w)];
    }
    // Estado del logo en el segundo p del ciclo: qué está tatuado, dónde va la punta y en qué fase está.
    function logoState(p) {
      var st = { lineSub: -1, lineLen: 0, fillX: -1, boxLine: 0, boxFill: 0, ar: 0, heal: 0, alpha: 1, pen: null, ink: false, phase: "" };
      var steps = logo.steps, b = logo.box, zig = 0.5 + 0.5 * Math.sin(p * 30);
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i], f = clamp((p - s.t0) / (s.t1 - s.t0), 0, 1), done = p >= s.t1;
        if (p < s.t0) break;
        if (s.k === "line") {
          st.lineSub = s.sub; st.lineLen = f * logo.subs[s.sub].len; st.phase = "line";
          if (!done) { st.pen = subPoint(logo.subs[s.sub], st.lineLen); st.ink = true; }
        } else if (s.k === "jump") {
          st.lineSub = s.from; st.lineLen = logo.subs[s.from].len; st.phase = "line";
          if (!done) {
            var a = subPoint(logo.subs[s.from], logo.subs[s.from].len), c = subPoint(logo.subs[s.to], 0);
            st.pen = [a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f];
          }
        } else if (s.k === "fill") {
          st.lineSub = logo.subs.length; st.fillX = f * 258; st.phase = "fill";
          if (!done) { st.pen = [st.fillX, -60 + 60 * zig]; st.ink = true; }
        } else if (s.k === "boxLine") {
          st.boxLine = f; st.phase = "color";
          if (!done) { st.pen = rectPoint(b, f); st.ink = true; }
        } else if (s.k === "boxFill") {
          st.boxFill = f; st.phase = "color";
          if (!done) { st.pen = [b.x + b.w * f, b.y + b.h * zig]; st.ink = true; }
        } else if (s.k === "ar") {
          st.ar = f; st.phase = "color";
          if (!done) { st.pen = [b.x + 11 + 61 * f, b.y + 11 + 20 * zig]; st.ink = true; }
        } else if (s.k === "heal") {
          st.heal = f; st.phase = done ? "done" : "heal";
        } else if (s.k === "hold") {
          st.heal = 1; st.phase = "done";
        } else if (s.k === "fade") {
          st.heal = 1; st.alpha = 1 - f; st.phase = "done";
        } else if (s.k === "rest") {
          st.alpha = 0; st.phase = "";
        }
      }
      if (st.lineSub >= logo.subs.length) st.lineSub = logo.subs.length;
      return st;
    }
    function mixHex(a, b, f) { return mix(hexRgb(a), hexRgb(b), f); }
    // Dibuja el logo tatuado. Fresco: tinta brillante y piel enrojecida alrededor.
    // Cicatrizado: el rojo se va, la tinta se asienta (bordes más suaves, negro menos profundo, grano de la piel).
    function drawLogo(st) {
      if (!logo || st.alpha <= 0) return;
      var k = LK * DPR, heal = st.heal;
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, lc.width, lc.height);
      lctx.setTransform(k, 0, 0, k, LX * DPR, LY * DPR);
      var black = mixHex("#0c0d10", "#262a31", heal), lime = mixHex("#c8f560", "#b2cf6b", heal);
      // Delineado
      lctx.lineJoin = "round"; lctx.lineCap = "round";
      lctx.strokeStyle = black; lctx.lineWidth = 1.7 / LK;
      for (var i = 0; i <= Math.min(st.lineSub, logo.subs.length - 1); i++) {
        var s = logo.subs[i], lim = i < st.lineSub ? s.len : st.lineLen, pts = s.pts;
        lctx.beginPath(); lctx.moveTo(pts[0], pts[1]);
        for (var j = 1; j < s.cum.length && s.cum[j] <= lim; j++) lctx.lineTo(pts[j * 2], pts[j * 2 + 1]);
        if (lim < s.len) { var e = subPoint(s, lim); lctx.lineTo(e[0], e[1]); }
        lctx.stroke();
      }
      // Relleno de la palabra
      if (st.fillX > 0) {
        lctx.save(); lctx.beginPath(); lctx.rect(-6, -72, st.fillX + 6, 80); lctx.clip();
        lctx.fillStyle = black; lctx.fill(logo.word); lctx.restore();
      }
      // Bloque AR: borde, color lima y letras
      var b = logo.box;
      if (st.boxFill > 0) {
        lctx.save(); lctx.beginPath(); lctx.rect(b.x - 1, b.y - 1, b.w * st.boxFill + 2, b.h + 2); lctx.clip();
        lctx.fillStyle = lime; lctx.fillRect(b.x, b.y, b.w, b.h); lctx.restore();
      }
      if (st.boxLine > 0) {
        lctx.strokeStyle = black; lctx.lineWidth = 1.7 / LK; lctx.beginPath();
        var steps = Math.max(2, Math.ceil(st.boxLine * 40)), p0 = rectPoint(b, 0);
        lctx.moveTo(p0[0], p0[1]);
        for (var q = 1; q <= steps; q++) { var pq = rectPoint(b, (st.boxLine * q) / steps); lctx.lineTo(pq[0], pq[1]); }
        lctx.stroke();
      }
      if (st.ar > 0) {
        lctx.save(); lctx.beginPath(); lctx.rect(b.x, b.y, 12 + 61 * st.ar, b.h); lctx.clip();
        lctx.fillStyle = black;
        lctx.save(); lctx.translate(b.x + 12, b.y + 29.5); lctx.scale(0.75, 0.75); lctx.fill(logo.ar); lctx.restore();
        lctx.fillRect(b.x + 52.5, b.y + 27, 18, 4.5);
        lctx.restore();
      }
      // La piel se asoma a través de la tinta cicatrizada
      if (heal > 0) {
        if (!grain) grain = lctx.createPattern(grainCanvas, "repeat");
        lctx.setTransform(1, 0, 0, 1, 0, 0);
        lctx.globalCompositeOperation = "source-atop";
        lctx.globalAlpha = 0.55 * heal; lctx.fillStyle = grain; lctx.fillRect(0, 0, lc.width, lc.height);
        lctx.globalAlpha = 1; lctx.globalCompositeOperation = "source-over";
      }
      // Sobre la piel: primero el enrojecimiento (solo la sombra), después la tinta.
      ictx.save();
      ictx.globalAlpha = st.alpha;
      var red = (1 - heal) * 0.85;
      if (red > 0.02) {
        ictx.shadowColor = "rgba(200,62,54," + (0.8 * red).toFixed(3) + ")";
        ictx.shadowBlur = (9 + 6 * red) * DPR; ictx.shadowOffsetX = 20000;
        ictx.drawImage(lc, -20000, 0);
        ictx.shadowOffsetX = 0;
      }
      ictx.shadowColor = "rgba(20,22,26," + (0.35 * heal).toFixed(3) + ")";
      ictx.shadowBlur = 2.2 * DPR * heal;          // la tinta se asienta y el borde se suaviza
      ictx.globalAlpha = st.alpha * (0.98 - 0.1 * heal);
      ictx.drawImage(lc, 0, 0);
      ictx.restore();
      // Brillo de tinta fresca (vaselina): un reflejo que se apaga al cicatrizar
      if (heal < 1 && st.lineSub >= 0) {
        ictx.save(); ictx.globalAlpha = st.alpha * 0.18 * (1 - heal); ictx.globalCompositeOperation = "screen";
        ictx.drawImage(lc, -1.2 * DPR, -1.2 * DPR); ictx.restore();
      }
    }
    // Rótulo de fase (delineado, relleno, color, día de cicatrización, sanado).
    var phaseEl = stage.querySelector(".ink-phase"), phaseTxt = "";
    function tr(key, fb) { var I = window.taI18n; var v = I && I.t ? I.t(key) : null; return typeof v === "string" ? v : fb; }
    function setPhase(st) {
      if (!phaseEl) return;
      var txt = "";
      if (st.phase === "line") txt = "01 · " + tr("ink.line", "Delineado");
      else if (st.phase === "fill") txt = "02 · " + tr("ink.fill", "Relleno");
      else if (st.phase === "color") txt = "03 · " + tr("ink.color", "Color");
      else if (st.phase === "heal") txt = tr("ink.day", "Cicatrizando · día") + " " + ("0" + (1 + Math.floor(st.heal * 13.99))).slice(-2);
      else if (st.phase === "done") txt = "✓ " + tr("ink.healed", "Tatuaje sanado");
      if (txt === phaseTxt) return;
      phaseTxt = txt; phaseEl.textContent = txt;
      phaseEl.classList.toggle("is-on", !!txt);
      phaseEl.classList.toggle("is-done", st.phase === "done");
    }
    logo = buildLogo();

    // ---------- Tamaño ----------
    var W = 1, H = 1, hh = 12 * Math.tan((15 * Math.PI) / 180), hw = hh;
    function resize() {
      var r = stage.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setSize(W, H, false);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      hw = hh * camera.aspect;
      rig.scale.setScalar(W < 520 ? 0.56 : clamp(Math.min(hw, hh) * 0.225, 0.55, 0.72));
      inkCv.width = Math.round(W * DPR); inkCv.height = Math.round(H * DPR);
      placeLogo();
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    else window.addEventListener("resize", resize);

    // ---------- Puntero ----------
    var ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 0, 1), 0);
    var ndc = new T.Vector2(), hit = new T.Vector3();
    var target = new T.Vector3(-0.45, -1.2, 0), tip = target.clone(), prevTip = tip.clone();
    var hovering = false, pressing = false, lastMove = -1e9, lastHover = -1e9, now = 0;
    function toTarget(e) {
      var r = stage.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(plane, hit)) {
        target.set(clamp(hit.x, -hw + 0.15, hw - 0.15), clamp(hit.y, -hh + 0.15, hh - 0.5), 0);
      }
    }
    function onUi(e) { return e.target && e.target.closest && e.target.closest(".ink-ui"); }
    function engage() {
      if (!hovering) { hovering = true; stage.classList.add("is-inking"); Buzz.wake(false); }
    }
    function release() { hovering = false; pressing = false; lastHover = now; stage.classList.remove("is-inking"); }
    stage.addEventListener("pointerenter", function (e) { if (onUi(e)) return; engage(); toTarget(e); });
    stage.addEventListener("pointermove", function (e) {
      if (onUi(e)) { if (hovering) release(); return; }
      engage(); toTarget(e); lastMove = now; lastHover = now;
    });
    stage.addEventListener("pointerdown", function (e) {
      if (onUi(e)) return;
      engage(); toTarget(e); lastMove = now; lastHover = now;
      Buzz.wake(true);
      pressing = e.pointerType === "mouse" && e.button === 0;
      splash(pressing ? 10 : 14);
    });
    window.addEventListener("pointerup", function () { pressing = false; });
    stage.addEventListener("pointerleave", release);
    stage.addEventListener("pointercancel", release);

    // ---------- Controles: sonido + color de tinta ----------
    var sBtn = stage.querySelector(".ink-sound");
    function syncSound() {
      if (!sBtn) return;
      sBtn.setAttribute("aria-pressed", Buzz.enabled ? "true" : "false");
      sBtn.querySelector(".lbl").textContent = Buzz.enabled ? "Sonido" : "Silencio";
    }
    if (sBtn) sBtn.addEventListener("click", function (e) { e.stopPropagation(); Buzz.toggle(); syncSound(); });
    syncSound();
    stage.querySelectorAll(".ink-sw").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        inkKey = b.getAttribute("data-ink") || "green";
        stage.querySelectorAll(".ink-sw").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        applyTheme();
        splash(10);
      });
    });

    // ---------- Tinta ----------
    var segs = [], drops = [], LIFE = 2800, lastInk = null;
    function project(v) {
      var p = v.clone().project(camera);
      return { x: ((p.x + 1) / 2) * W * DPR, y: ((1 - p.y) / 2) * H * DPR };
    }
    function addInk(pt, speed, press) {
      if (lastInk) {
        var dx = pt.x - lastInk.x, dy = pt.y - lastInk.y, min = 1.1 * DPR;
        if (dx * dx + dy * dy < min * min) return;
        segs.push({ x1: lastInk.x, y1: lastInk.y, x2: pt.x, y2: pt.y, t: now, b: inkBase, c: inkLive,
          w: clamp(4.4 - speed * 0.05, 1.6, 4.4) * (press ? 2.1 : 1) * DPR, fs: now + LIFE * 0.7, fe: now + LIFE });
        if (segs.length > 2400) segs.splice(0, segs.length - 2400);
        if (Math.random() < (press ? 0.32 : 0.18)) drop(pt, press ? 1 : 0.6, inkLive);
      }
      lastInk = pt;
    }
    function drop(pt, k, c) {
      var a = Math.random() * Math.PI * 2, s = (0.4 + Math.random() * 1.6) * k * DPR;
      drops.push({ x: pt.x, y: pt.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.4 * DPR, r: (0.8 + Math.random() * 1.6) * DPR, t: now, c: c || inkLive });
      if (drops.length > 160) drops.shift();
    }
    function splash(n) {
      var pt = project(tip);
      for (var q = 0; q < n; q++) drop(pt, 2.2);
    }
    function mix(a, b, f) {
      return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * f) + "," + Math.round(a[1] + (b[1] - a[1]) * f) + "," + Math.round(a[2] + (b[2] - a[2]) * f) + ")";
    }
    function drawInk(logoSt) {
      ictx.clearRect(0, 0, inkCv.width, inkCv.height);
      if (logoSt) drawLogo(logoSt);
      var n = 0;
      for (var q = 0; q < segs.length; q++) if (now < segs[q].fe) segs[n++] = segs[q];
      segs.length = n;
      ictx.lineCap = "round";
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        var live = clamp((now - s.t - 220) / 840, 0, 1);     // la tinta "cobra vida"
        var alpha = now < s.fs ? 1 : clamp(1 - (now - s.fs) / (s.fe - s.fs), 0, 1);
        ictx.strokeStyle = mix(s.b, s.c, live);
        ictx.globalAlpha = alpha * 0.16 * live;              // halo
        ictx.lineWidth = s.w * 3.4;
        ictx.beginPath(); ictx.moveTo(s.x1, s.y1); ictx.lineTo(s.x2, s.y2); ictx.stroke();
        ictx.globalAlpha = alpha;
        ictx.lineWidth = s.w;
        ictx.beginPath(); ictx.moveTo(s.x1, s.y1); ictx.lineTo(s.x2, s.y2); ictx.stroke();
      }
      var dcut = 0;
      while (dcut < drops.length && now - drops[dcut].t > 800) dcut++;
      if (dcut) drops.splice(0, dcut);
      for (var j = 0; j < drops.length; j++) {
        var d = drops[j], f = (now - d.t) / 800;
        d.x += d.vx; d.y += d.vy; d.vy += 0.05 * DPR; d.vx *= 0.96;
        ictx.fillStyle = "rgb(" + d.c.join(",") + ")";
        ictx.globalAlpha = 1 - f;
        ictx.beginPath(); ictx.arc(d.x, d.y, d.r * (1 - f * 0.5), 0, 6.283); ictx.fill();
      }
      ictx.globalAlpha = 1;
      // Sombra de contacto de la máquina sobre la piel: más chica y marcada cuando apoya.
      var sp = project(tip), sr = (26 + lift * 60) * DPR, so = (10 + lift * 34) * DPR;
      var g = ictx.createRadialGradient(sp.x + so, sp.y + so * 0.6, 0, sp.x + so, sp.y + so * 0.6, sr);
      g.addColorStop(0, "rgba(60,30,20," + (0.28 - lift * 0.3).toFixed(3) + ")"); g.addColorStop(1, "rgba(60,30,20,0)");
      ictx.fillStyle = g; ictx.fillRect(sp.x + so - sr, sp.y + so * 0.6 - sr, sr * 2, sr * 2);
    }

    // ---------- Loop ----------
    var t0 = performance.now(), prev = t0, lean = 0, pitch = 0, lift = 0.4, buzz = 0, press = 0, volt = 0;
    var running = false, raf = 0, autoStart = -1, frozen = null, frozenAt = 0, logoSt = null, lastLogo = null, penW = new T.Vector3();
    function frame(ts) {
      raf = running ? requestAnimationFrame(frame) : 0;
      var dt = Math.min(0.05, (ts - prev) / 1000); prev = ts; now = ts;
      var time = (ts - t0) / 1000;
      var auto = !hovering && now - lastHover > 1400 && !reduce;
      var inking;

      logoSt = null;
      if (reduce && logo && !hovering) {
        // Sin animaciones: el logo ya tatuado y sanado, quieto.
        logoSt = logoState(logo.cycle - PH.rest - PH.fade - 0.01);
        inking = false;
      } else if (auto && logo) {
        if (autoStart < 0) { autoStart = now; frozen = null; }
        var p = (now - autoStart) / 1000;
        if (p > logo.cycle) { autoStart = now; p = 0; }
        logoSt = logoState(p);
        if (logoSt.pen) {
          logoToWorld(logoSt.pen[0], logoSt.pen[1], penW);
          target.copy(penW);
        } else {                               // en reposo: arriba a la derecha del logo (el cuerpo apunta hacia afuera)
          logoToWorld(logo.bounds.x1 - 18, logo.bounds.y0 - 14, target);
          target.x = Math.min(target.x, hw * 0.5);   // que la máquina quede dentro del recuadro
        }
        inking = logoSt.ink;
        if (inking) tip.copy(target);          // tatuando: la punta va exacta sobre el trazo
        else tip.lerp(target, 1 - Math.exp(-dt * 9));
      } else {
        if (autoStart >= 0) {                  // el usuario toma la máquina: el logo a medias se desvanece
          autoStart = -1;
          frozen = lastLogo; frozenAt = now;
        }
        if (frozen) {
          var fa = 1 - (now - frozenAt) / 600;
          if (fa > 0) { logoSt = Object.assign({}, frozen, { alpha: frozen.alpha * fa }); } else frozen = null;
        }
        inking = hovering && (pressing || now - lastMove < 140);
        tip.lerp(target, 1 - Math.exp(-dt * 16));
      }
      if (logoSt && !frozen) lastLogo = logoSt;
      setPhase(auto && logoSt && !reduce ? logoSt : { phase: reduce && logoSt ? "done" : "" });
      var pressed = pressing && hovering;

      var vx = (tip.x - prevTip.x) / Math.max(dt, 1e-3), vy = (tip.y - prevTip.y) / Math.max(dt, 1e-3);
      var speedPx = Math.hypot(tip.x - prevTip.x, tip.y - prevTip.y) * (H / (2 * hh));
      prevTip.copy(tip);

      lean = damp(lean, clamp(-vx * 0.035, -0.28, 0.28), 8, dt);
      pitch = damp(pitch, clamp(vy * 0.03, -0.2, 0.2), 8, dt);
      lift = damp(lift, inking ? (pressed ? -0.18 : 0) : 0.45, 10, dt);
      buzz = damp(buzz, inking ? (pressed ? 1.4 : 1) : hovering ? 0.45 : 0.12, 14, dt);
      press = damp(press, pressed ? 1 : 0, 12, dt);
      // Voltaje mostrado: apagado → 0, en el aire → 7.4 V, tatuando → 8.6 V, presionando → 10.2 V
      var vTarget = hovering ? (inking ? (pressed ? 10.2 : 8.6) : 7.4) : auto ? (inking ? 8.6 : 7.4) : 0;
      volt = damp(volt, vTarget, 6, dt);
      drawDisplay(volt, volt > 0.5);

      var float = hovering ? 0 : Math.sin(time * 1.4) * 0.04;
      var j = reduce ? 0 : buzz * 0.007;
      rig.position.set(tip.x + (Math.random() - 0.5) * j + lift * 0.12,
                       tip.y + lift * 0.25 + float + (Math.random() - 0.5) * j, lift * 0.9);
      rig.rotation.set(-0.12 + pitch - press * 0.08, 0.3, -0.6 + lean);
      if (!reduce) pen.rotation.y = Math.sin(time * 0.5) * 0.45;
      needle.position.y = 0.45 + (reduce ? 0 : (Math.random() - 0.5) * 0.06 * buzz);

      // LEDs: respiran en reposo, parpadean al tatuar
      var glow = volt > 0.5 ? (inking ? 0.85 + Math.random() * 0.35 : 0.55 + Math.sin(time * 3) * 0.2) : 0.25;
      matLed.color.set(accentHex).multiplyScalar(glow);
      matAccent.emissiveIntensity = 0.45 + buzz * 0.7;

      // Sonido: más grave y fuerte al presionar (carga sobre el motor), agudo y suave en el aire
      if (hovering) {
        var vol = inking ? (pressed ? 0.15 : 0.1) : 0.045;
        var freq = inking ? (pressed ? 104 : 118) : 134;
        Buzz.set(vol, freq, pressed ? 2300 : 3400);
      } else Buzz.set(0, 130, 3400);

      if (inking && !auto) addInk(project(tip), speedPx, pressed); else lastInk = null;
      drawInk(logoSt);
      renderer.render(scene, camera);
    }
    function setRunning(on) {
      if (on === running) return;
      running = on;
      if (on) { prev = performance.now(); raf = requestAnimationFrame(frame); }
      else { if (raf) cancelAnimationFrame(raf); raf = 0; Buzz.sleep(); }
    }
    var visible = false;
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting; setRunning(visible && !document.hidden);
    }, { rootMargin: "120px 0px" }).observe(stage);
    document.addEventListener("visibilitychange", function () { setRunning(visible && !document.hidden); });

    stage.classList.add("gl-ready");
    drawDisplay(0, false);
    renderer.render(scene, camera);
  }
})();
