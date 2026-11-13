// studio.js — Generador (tatuador): imagen -> efecto -> target AR -> diseño + QR.

const fileInput = document.getElementById("file");
const pickBtn = document.getElementById("pick");
const dropEl = document.getElementById("drop");
const dropEmpty = document.getElementById("drop-empty");
const previewCanvas = document.getElementById("preview");
const alphaNote = document.getElementById("alpha-note");
const effectsEl = document.getElementById("effects");
const p1El = document.getElementById("p1");
const p2El = document.getElementById("p2");
const l1El = document.getElementById("l1");
const l2El = document.getElementById("l2");
const accentEl = document.getElementById("accent");
const generateBtn = document.getElementById("generate");
const genStatus = document.getElementById("gen-status");
const resultEl = document.getElementById("result");
const downloadBtn = document.getElementById("download");
const testBtn = document.getElementById("test");
const hostedUrlEl = document.getElementById("hosted-url");
const makeQrBtn = document.getElementById("make-qr");
const qrEl = document.getElementById("qr");

const state = {
  image: null, // HTMLImageElement (target)
  imageDataURL: null,
  hasAlpha: false,
  contentType: "effect", // "effect" | "video"
  effect: window.TattooEffects.LIST[0].id,
  p1: window.TattooEffects.LIST[0].p1.default,
  p2: window.TattooEffects.LIST[0].p2.default,
  accent: window.TattooEffects.LIST[0].accent,
  video: { file: null, objUrl: null, blobUrl: null, mode: "luma-white", solidez: 0.62, soft: 0.12, contrast: 1.12 },
  mindBase64: null,
};

// Solidez (0..1) -> umbral de blanco (0.72..0.94). Más solidez = conserva más trazo.
function solidezToWhite(s) { return 0.72 + s * 0.22; }

// ---------- Tabs de contenido: Efecto / Video ----------
const ctEffect = document.getElementById("ct-effect");
const ctVideo = document.getElementById("ct-video");
const paneEffect = document.getElementById("pane-effect");
const paneVideo = document.getElementById("pane-video");
const videoFileInput = document.getElementById("video-file");
const pickVideoBtn = document.getElementById("pick-video");
const vModeEl = document.getElementById("v-mode");
const vGainEl = document.getElementById("v-gain");
const videoNote = document.getElementById("video-note");

function setContentType(type) {
  state.contentType = type;
  ctEffect.classList.toggle("active", type === "effect");
  ctVideo.classList.toggle("active", type === "video");
  paneEffect.hidden = type !== "effect";
  paneVideo.hidden = type !== "video";
  if (tex) { startPreview(); }
}
ctEffect.addEventListener("click", () => setContentType("effect"));
ctVideo.addEventListener("click", () => setContentType("video"));

pickVideoBtn.addEventListener("click", () => videoFileInput.click());
videoFileInput.addEventListener("change", () => {
  const f = videoFileInput.files[0];
  if (!f) return;
  state.video.file = f;
  state.video.blobUrl = null; // hay que re-subir
  if (state.video.objUrl) URL.revokeObjectURL(state.video.objUrl);
  state.video.objUrl = URL.createObjectURL(f);
  videoNote.textContent = "✓ " + f.name + " (" + Math.round(f.size / 1e6 * 10) / 10 + " MB)";
  loadPreviewVideo();
});
vModeEl.addEventListener("change", () => {
  state.video.mode = vModeEl.value;
  if (videoMat) videoMat.uniforms.keyMode.value = videoKeyModeInt();
});
vGainEl.addEventListener("input", () => {
  state.video.solidez = +vGainEl.value;
  if (videoMat) videoMat.uniforms.white.value = solidezToWhite(state.video.solidez);
});

// ---------- Grilla de efectos ----------
window.TattooEffects.LIST.forEach((e) => {
  const b = document.createElement("button");
  b.className = "effect-btn";
  b.dataset.id = e.id;
  b.textContent = e.name;
  b.addEventListener("click", () => selectEffect(e.id));
  effectsEl.appendChild(b);
});

function selectEffect(id) {
  const meta = window.TattooEffects.LIST.find((e) => e.id === id);
  state.effect = id;
  state.p1 = meta.p1.default;
  state.p2 = meta.p2.default;
  state.accent = meta.accent;
  l1El.textContent = meta.p1.label;
  l2El.textContent = meta.p2.label;
  p1El.min = meta.p1.min; p1El.max = meta.p1.max; p1El.value = meta.p1.default;
  p2El.min = meta.p2.min; p2El.max = meta.p2.max; p2El.value = meta.p2.default;
  accentEl.value = meta.accent;
  effectsEl.querySelectorAll(".effect-btn").forEach((el) =>
    el.classList.toggle("active", el.dataset.id === id));
  rebuildMaterial();
}

p1El.addEventListener("input", () => { state.p1 = +p1El.value; if (mat) mat.uniforms.p1.value = state.p1; });
p2El.addEventListener("input", () => { state.p2 = +p2El.value; if (mat) mat.uniforms.p2.value = state.p2; });
accentEl.addEventListener("input", () => { state.accent = accentEl.value; if (mat) mat.uniforms.accent.value.set(state.accent); });

// ---------- Carga de imagen ----------
pickBtn.addEventListener("click", () => fileInput.click());
dropEl.addEventListener("click", (e) => { if (e.target === dropEl && !state.image) fileInput.click(); });
dropEl.addEventListener("dragover", (e) => { e.preventDefault(); dropEl.classList.add("drag"); });
dropEl.addEventListener("dragleave", () => dropEl.classList.remove("drag"));
dropEl.addEventListener("drop", (e) => {
  e.preventDefault(); dropEl.classList.remove("drag");
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    state.imageDataURL = reader.result;
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.hasAlpha = detectAlpha(img);
      alphaNote.textContent = state.hasAlpha
        ? "✓ La imagen tiene transparencia: se recorta perfecto a la silueta."
        : "ⓘ Imagen sin transparencia: se recorta la silueta automáticamente por brillo (mejor con fondo oscuro/uniforme).";
      dropEmpty.hidden = true;
      previewCanvas.hidden = false;
      generateBtn.disabled = false;
      startPreview();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function detectAlpha(img) {
  const c = document.createElement("canvas");
  const w = (c.width = Math.min(img.naturalWidth, 128));
  const h = (c.height = Math.min(img.naturalHeight, 128));
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
}

// ---------- Preview con THREE ----------
let renderer, scene, camera, quad, mat, tex, rafId;
let previewVideo, videoTex, videoMat;

function ensureRenderer() {
  const size = Math.min(previewCanvas.parentElement.clientWidth, 420);
  previewCanvas.width = size;
  previewCanvas.height = size;
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas: previewCanvas, alpha: true, antialias: true });
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 10);
    camera.position.z = 1;
  }
  renderer.setSize(size, size, false);
}

function fitQuad(ratio, material) {
  if (quad) scene.remove(quad);
  const geo = new THREE.PlaneGeometry(ratio <= 1 ? 1 : 1 / ratio, ratio <= 1 ? ratio : 1);
  quad = new THREE.Mesh(geo, material);
  scene.add(quad);
}

function startPreview() {
  ensureRenderer();
  if (state.contentType === "video" && previewVideo && previewVideo.videoWidth) {
    tex = tex || new THREE.Texture(state.image || document.createElement("canvas"));
    videoMat = buildVideoMaterial();
    fitQuad(previewVideo.videoHeight / previewVideo.videoWidth || 1, videoMat);
  } else if (state.image) {
    tex = new THREE.Texture(state.image);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    rebuildMaterial();
    fitQuad(state.image.naturalHeight / state.image.naturalWidth || 1, mat);
  }
  if (!rafId) loop();
}

function rebuildMaterial() {
  if (!tex) return;
  mat = window.TattooEffects.buildMaterial(THREE, tex, {
    effect: state.effect, p1: state.p1, p2: state.p2,
    accent: state.accent, useMaskLuma: !state.hasAlpha, appear: 1,
  });
  if (quad && state.contentType === "effect") quad.material = mat;
}

function videoKeyModeInt() {
  return { none: 0, "luma-white": 1, "luma-black": 2, chroma: 3 }[state.video.mode] ?? 1;
}

function buildVideoMaterial() {
  videoTex = new THREE.VideoTexture(previewVideo);
  videoTex.colorSpace = THREE.SRGBColorSpace;
  videoTex.minFilter = THREE.LinearMipmapLinearFilter;
  videoTex.generateMipmaps = true;
  videoTex.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
      map: { value: videoTex },
      keyMode: { value: videoKeyModeInt() },
      white: { value: solidezToWhite(state.video.solidez) },
      soft: { value: state.video.soft },
      contrast: { value: state.video.contrast },
      threshold: { value: 0.04 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `
      precision highp float; varying vec2 vUv;
      uniform sampler2D map; uniform int keyMode; uniform float white; uniform float soft; uniform float contrast; uniform float threshold;
      float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
      void main(){
        vec4 t = texture2D(map, vUv);
        vec3 rgb = clamp((t.rgb-0.5)*contrast+0.5, 0.0, 1.0);
        float l = luma(t.rgb);
        float a = 1.0;
        if (keyMode==1) a = smoothstep(white, white - soft, l);
        else if (keyMode==2) a = smoothstep(1.0-white, 1.0-white+soft, l);
        else if (keyMode==3) a = smoothstep(soft, soft+0.15, distance(t.rgb, vec3(0.0,1.0,0.0)));
        else a = t.a;
        if (a < threshold) discard;
        gl_FragColor = vec4(rgb, a);
      }
    `,
  });
}

function loadPreviewVideo() {
  if (!previewVideo) {
    previewVideo = document.createElement("video");
    previewVideo.loop = true; previewVideo.muted = true; previewVideo.playsInline = true;
    previewVideo.setAttribute("playsinline", ""); previewVideo.setAttribute("webkit-playsinline", "");
  }
  previewVideo.src = state.video.objUrl;
  previewVideo.addEventListener("loadedmetadata", () => {
    dropEmpty.hidden = true;
    previewCanvas.hidden = false;
    previewVideo.play().catch(() => {});
    startPreview();
  }, { once: true });
  previewVideo.load();
}

function loop() {
  rafId = requestAnimationFrame(loop);
  if (state.contentType === "effect" && mat) mat.uniforms.time.value = performance.now() / 1000;
  if (state.contentType === "video" && videoTex) videoTex.needsUpdate = true;
  if (renderer && scene && camera) renderer.render(scene, camera);
}

// ---------- Imágenes derivadas del diseño ----------
// Dibuja la imagen en un canvas con lado mayor acotado. Con `bg`, rellena el fondo antes (quita la transparencia).
function drawScaled(maxSide, bg) {
  const img = state.image, k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = c.getContext("2d");
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
// Imagen que aprende la cámara. Un PNG transparente se compila sobre un tono claro, como tinta sobre piel:
// si no, el compilador ve el fondo negro y la tinta oscura no deja rasgos que reconocer.
function targetImage() {
  const c = drawScaled(900, state.hasAlpha ? "#e6d2c1" : null);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = c.toDataURL("image/png");
  });
}
// Imagen que se anima en AR (conserva la transparencia), liviana para el teléfono.
function artBlob() {
  return new Promise((resolve) => drawScaled(1024, null).toBlob(resolve, "image/png"));
}
function targetAspect() {
  return state.image ? +(state.image.naturalHeight / state.image.naturalWidth).toFixed(4) : null;
}

// ---------- Compilar target .mind en el navegador ----------
generateBtn.addEventListener("click", async () => {
  if (!state.image) return;
  if (!window.MINDAR || !window.MINDAR.IMAGE) {
    genStatus.textContent = "El motor de compilación aún carga… probá en unos segundos.";
    return;
  }
  generateBtn.disabled = true;
  genStatus.textContent = "Compilando target del tatuaje… (unos segundos en Chrome/Safari de escritorio)";
  try {
    const compiler = new window.MINDAR.IMAGE.Compiler();
    const compile = compiler.compileImageTargets([await targetImage()], (p) => {
      genStatus.textContent = `Compilando target… ${Math.round(p)}%`;
    });
    // Guarda contra cuelgues: si tarda demasiado, ofrecemos importar el .mind.
    await Promise.race([
      compile,
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 90000)),
    ]);
    const buffer = await compiler.exportData();
    state.mindBase64 = arrayBufferToBase64(buffer);
    genStatus.textContent = "✓ Listo. La cámara ya puede reconocer este tatuaje.";
    resultEl.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    genStatus.textContent = err.message === "timeout"
      ? "⏱ La compilación tarda demasiado en este dispositivo. Usá el compilador oficial e importá el .mind (botón de abajo)."
      : "✗ No se pudo compilar. Probá con una imagen más nítida, o importá un .mind.";
    generateBtn.disabled = false;
  }
});

// Vía alternativa: importar un .mind ya compilado (compilador oficial de MindAR).
const mindFileInput = document.getElementById("mind-file");
document.getElementById("import-mind").addEventListener("click", () => mindFileInput.click());
mindFileInput.addEventListener("change", () => {
  const f = mindFileInput.files[0];
  if (!f) return;
  if (!state.image) { genStatus.textContent = "Primero subí la imagen del tatuaje."; return; }
  const r = new FileReader();
  r.onload = () => {
    state.mindBase64 = arrayBufferToBase64(r.result);
    genStatus.textContent = "✓ .mind importado. Ya podés publicar el diseño.";
    resultEl.classList.remove("hidden");
  };
  r.readAsArrayBuffer(f);
});

function buildContent() {
  if (state.contentType === "video") {
    return {
      type: "video", url: state.video.blobUrl, mode: state.video.mode,
      white: solidezToWhite(state.video.solidez), soft: state.video.soft,
      contrast: state.video.contrast, threshold: 0.04,
    };
  }
  return { type: "effect", id: state.effect, p1: state.p1, p2: state.p2, accent: state.accent, useMaskLuma: !state.hasAlpha };
}

function designName() {
  const el = document.getElementById("design-name");
  return (el && el.value.trim()) || "";
}

// Diseño autocontenido (imagen y .mind dentro del archivo): para probar y para descargar.
function buildDesign() {
  return {
    format: "tattoo-ar/2",
    name: designName() || "tatuaje",
    createdAt: new Date().toISOString(),
    image: state.imageDataURL,
    mind: state.mindBase64,
    targetAspect: targetAspect(),
    content: buildContent(),
  };
}

// Diseño publicado: un .json mínimo que apunta a la imagen y al .mind por URL.
// El escáner descarga solo lo que necesita y arranca mucho más rápido.
function buildPublishedDesign(imageUrl, mindUrl) {
  return {
    format: "tattoo-ar/3",
    name: designName() || "tatuaje",
    createdAt: new Date().toISOString(),
    image: imageUrl,
    mindUrl: mindUrl,
    targetAspect: targetAspect(),
    content: buildContent(),
  };
}

function base64ToBlob(b64, type) {
  const bin = atob(b64), n = bin.length, arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

// Sube un archivo/blob a Supabase Storage (bucket público 'assets') y devuelve su URL pública.
async function uploadToStorage(data, folder, filename, contentType) {
  const client = window.taAuth && window.taAuth.client();
  if (!client) throw new Error("Sin conexión con el servidor. Iniciá sesión de nuevo.");
  const safe = (filename || "file").replace(/[^a-z0-9_.-]/gi, "-").slice(0, 60);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const { error } = await client.storage.from("assets").upload(path, data, {
    contentType: contentType, cacheControl: "31536000", upsert: false,
  });
  if (error) throw new Error(error.message || "No se pudo subir el archivo.");
  const { data: pub } = client.storage.from("assets").getPublicUrl(path);
  return pub.publicUrl;
}

// Sube el video a Supabase Storage (directo del navegador) si hace falta.
async function ensureVideoUploaded(onProgress) {
  if (state.contentType !== "video") return;
  if (!state.video.file) throw new Error("Subí un video primero.");
  if (state.video.blobUrl) return;
  onProgress && onProgress("Subiendo video…");
  state.video.blobUrl = await uploadToStorage(
    state.video.file, "videos", state.video.file.name, state.video.file.type || "video/mp4"
  );
}

downloadBtn.addEventListener("click", async () => {
  try {
    await ensureVideoUploaded((m) => (pubStatus.textContent = m));
    const blob = new Blob([JSON.stringify(buildDesign())], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tattoo-ar-design.json";
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) { alert(e.message); }
});

testBtn.addEventListener("click", async () => {
  try {
    await ensureVideoUploaded((m) => (pubStatus.textContent = m));
    sessionStorage.setItem("tattooar:test-design", JSON.stringify(buildDesign()));
    window.open("scan.html?test=1", "_blank");
  } catch (e) {
    alert("No se pudo preparar la prueba: " + e.message);
  }
});

// Link del cliente. Con el id del diseño queda corto (QR más simple y fácil de leer);
// los diseños sin registrar usan el formato antiguo con la URL del .json.
function buildScanUrl(designUrl, viewId) {
  var base = new URL("scan.html", location.href).href;
  if (viewId) return `${base}?t=${encodeURIComponent(viewId)}`;
  return `${base}?d=${encodeURIComponent(designUrl)}`;
}

// dataURL -> Blob (para subir la imagen del tatuaje a Storage).
function dataURLtoBlob(url) {
  var parts = url.split(","), mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/png";
  var bin = atob(parts[1]), n = bin.length, arr = new Uint8Array(n);
  while (n--) arr[n] = bin.charCodeAt(n);
  return new Blob([arr], { type: mime });
}

// Registra el diseño publicado en Supabase (para stats/admin/escáner). Devuelve el id.
async function registerDesign(designUrl, imageUrl) {
  try {
    if (!window.taAuth || !window.taAuth.client()) return null;
    var s = await window.taAuth.session();
    if (!s) return null;
    var nameEl = document.getElementById("design-name");
    var name = (nameEl && nameEl.value.trim()) ||
      ("Diseño " + new Date().toLocaleDateString());
    var r = await window.taAuth.client()
      .from("designs")
      .insert({ owner: s.user.id, name: name, design_url: designUrl, image_url: imageUrl || null })
      .select("id")
      .single();
    return r.data ? r.data.id : null;
  } catch (e) { console.warn("[tattoo-ar] no se pudo registrar el diseño:", e); return null; }
}

function renderQr(scanUrl) {
  qrEl.innerHTML = "";
  const box = document.createElement("div");
  box.className = "qr-box";
  new QRCode(box, { text: scanUrl, width: 440, height: 440, colorDark: "#0b0b0b", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
  box.removeAttribute("title");
  qrEl.appendChild(box);

  const link = document.createElement("a");
  link.href = scanUrl; link.textContent = scanUrl.replace(/^https?:\/\//, ""); link.target = "_blank"; link.rel = "noopener"; link.className = "qr-link";
  qrEl.appendChild(link);

  const actions = document.createElement("div");
  actions.className = "qr-actions";
  const copy = document.createElement("button");
  copy.className = "btn-ghost"; copy.type = "button"; copy.textContent = "Copiar link"; copy.dataset.copy = scanUrl;
  const sticker = document.createElement("button");
  sticker.className = "btn-ghost"; sticker.type = "button"; sticker.textContent = "Descargar sticker QR";
  sticker.addEventListener("click", async () => {
    sticker.disabled = true;
    try { await downloadSticker(scanUrl, designName()); }
    catch (e) { console.error(e); pubStatus.textContent = "✗ No se pudo generar el sticker."; }
    sticker.disabled = false;
  });
  actions.appendChild(copy); actions.appendChild(sticker);
  qrEl.appendChild(actions);
}

// Sticker para la vidriera (manual de marca, sección 09): gótica "Escaneá", QR y logo. PNG de 1080 × 1440.
async function downloadSticker(scanUrl, name) {
  const W = 1080, H = 1440, INK = "#0b0b0b", BONE = "#f2f0eb", LIME = "#c8f560";
  if (document.fonts && document.fonts.load) {
    await Promise.all([document.fonts.load("800 200px 'Grenze Gotisch'"), document.fonts.load("700 30px 'Space Mono'")]).catch(() => {});
  }
  const tmp = document.createElement("div");
  new QRCode(tmp, { text: scanUrl, width: 640, height: 640, colorDark: INK, colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
  const qrCanvas = tmp.querySelector("canvas");
  if (!qrCanvas) throw new Error("qr");

  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = INK; c.fillRect(0, 0, W, H);
  c.fillStyle = "rgba(255,255,255,.03)";
  for (let y = 0; y < H; y += 6) c.fillRect(0, y, W, 2);

  c.textAlign = "center"; c.textBaseline = "alphabetic";
  c.fillStyle = BONE; c.font = "800 210px 'Grenze Gotisch', serif";
  c.fillText("Escaneá", W / 2, 268);
  c.fillStyle = LIME; c.font = "700 30px 'Space Mono', monospace";
  if ("letterSpacing" in c) c.letterSpacing = "7px";
  c.fillText("TU TATUAJE COBRA VIDA", W / 2 + 3, 336);

  const qs = 720, qx = (W - qs) / 2, qy = 410;
  c.fillStyle = "#ffffff"; c.fillRect(qx, qy, qs, qs);
  c.imageSmoothingEnabled = false;
  c.drawImage(qrCanvas, qx + 40, qy + 40, qs - 80, qs - 80);
  c.imageSmoothingEnabled = true;
  // Esquinas de visor alrededor del QR
  c.strokeStyle = LIME; c.lineWidth = 8;
  const o = 34, L = 74, x0 = qx - o, y0 = qy - o, x1 = qx + qs + o, y1 = qy + qs + o;
  [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([x, y, dx, dy]) => {
    c.beginPath(); c.moveTo(x + dx * L, y); c.lineTo(x, y); c.lineTo(x, y + dy * L); c.stroke();
  });

  if (name) {
    c.fillStyle = BONE; c.font = "700 26px 'Space Mono', monospace";
    if ("letterSpacing" in c) c.letterSpacing = "4px";
    c.fillText(name.toUpperCase().slice(0, 34), W / 2, qy + qs + 104);
  }
  if ("letterSpacing" in c) c.letterSpacing = "0px";

  if (window.taLogo) {
    const svg = window.taLogo.svg("horizontal", { glitch: false, label: "" });
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
    const lw = 430, lh = lw * 76 / 362;
    c.drawImage(img, (W - lw) / 2, H - 80 - lh, lw, lh);
  }

  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tattooar-qr-" + ((name || "tatuaje").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tatuaje") + ".png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Publicar: sube imagen, reconocimiento (.mind) y el .json del diseño a Supabase Storage,
// registra el diseño y entrega el link corto + QR.
const publishBtn = document.getElementById("publish");
const pubStatus = document.getElementById("pub-status");
publishBtn.addEventListener("click", async () => {
  if (!state.mindBase64) { pubStatus.textContent = "Primero generá el diseño AR (paso 2)."; return; }
  publishBtn.disabled = true;
  try {
    await ensureVideoUploaded((m) => (pubStatus.textContent = m));
    const nm = designName() || "tatuaje";
    pubStatus.textContent = "Subiendo imagen… (1/3)";
    const imageUrl = await uploadToStorage(await artBlob(), "images", nm + ".png", "image/png");
    pubStatus.textContent = "Subiendo reconocimiento… (2/3)";
    let mindUrl = null;
    try {
      mindUrl = await uploadToStorage(base64ToBlob(state.mindBase64, "application/octet-stream"), "minds", nm + ".mind", "application/octet-stream");
    } catch (e) {
      // Si el almacenamiento no acepta el archivo, el reconocimiento viaja dentro del .json (más pesado, pero funciona igual).
      console.warn("[tattoo-ar] .mind aparte no disponible, va dentro del diseño:", e.message);
    }
    pubStatus.textContent = "Publicando diseño… (3/3)";
    const published = buildPublishedDesign(imageUrl, mindUrl);
    if (!mindUrl) { delete published.mindUrl; published.mind = state.mindBase64; }
    const json = new Blob([JSON.stringify(published)], { type: "application/json" });
    const designUrl = await uploadToStorage(json, "designs", nm + ".json", "application/json");
    const viewId = await registerDesign(designUrl, imageUrl);
    const scanUrl = buildScanUrl(designUrl, viewId);
    pubStatus.textContent = "✓ Publicado. Compartí el link o el QR con tu cliente:";
    renderQr(scanUrl);
    loadMyDesigns();
  } catch (err) {
    console.error(err);
    pubStatus.textContent = "✗ " + err.message;
  } finally {
    publishBtn.disabled = false;
  }
});

// Fallback avanzado: URL hospedada a mano.
makeQrBtn.addEventListener("click", () => {
  const url = hostedUrlEl.value.trim();
  if (!url) return alert("Pegá la URL pública del .json alojado.");
  renderQr(buildScanUrl(url));
});

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ---- Mis diseños (Supabase) ----
function esc(s) { return String(s == null ? "" : s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }
function fmtDate(s) { try { return new Date(s).toLocaleDateString(); } catch (e) { return "—"; } }

async function loadMyDesigns() {
  try {
    if (!window.taAuth || !window.taAuth.client()) return;
    const s = await window.taAuth.session();
    if (!s) return;
    const sec = document.getElementById("mydesigns");
    const body = document.getElementById("mydesigns-body");
    const count = document.getElementById("mydesigns-count");
    if (!sec || !body) return;
    const r = await window.taAuth.client()
      .from("designs").select("*").eq("owner", s.user.id).order("created_at", { ascending: false });
    const rows = r.data || [];
    sec.hidden = false;
    if (count) count.textContent = rows.length + (rows.length === 1 ? " diseño" : " diseños");
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="4" class="hint center">Todavía no publicaste diseños. Publicá uno arriba y aparece acá.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (d) {
      var scan = d.design_url ? buildScanUrl(d.design_url, d.id) : "";
      var actions = scan
        ? '<button class="btn-ghost tiny" data-copy="' + esc(scan) + '">Copiar link</button> ' +
          '<a class="qr-link" href="' + esc(scan) + '" target="_blank" rel="noopener">abrir</a>'
        : "—";
      return '<tr><td>' + esc(d.name || "Diseño") + '</td><td><b>' + (d.views || 0) + '</b></td><td>' +
        fmtDate(d.created_at) + '</td><td class="right">' + actions + '</td></tr>';
    }).join("");
  } catch (e) { console.warn("[tattoo-ar] mis diseños:", e); }
}

// Copiar link desde la tabla
document.addEventListener("click", async function (e) {
  var btn = e.target.closest && e.target.closest("button[data-copy]");
  if (!btn) return;
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    var prev = btn.textContent; btn.textContent = "¡Copiado!";
    setTimeout(function () { btn.textContent = prev; }, 1400);
  } catch (_) { prompt("Copiá el link:", btn.dataset.copy); }
});

// Exponer para refrescar tras publicar / desde el guard
window.taLoadMyDesigns = loadMyDesigns;

// init
selectEffect(state.effect);
loadMyDesigns();
