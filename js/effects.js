/**
 * effects.js — Motor de "animación viva" generada a partir de la imagen.
 *
 * Cada efecto es un fragment shader que toma la textura del tatuaje y la anima
 * en tiempo real usando sus propios píxeles y su silueta (canal alpha, o luma si
 * la imagen no tiene alpha). NO es un video: la animación se genera de la imagen.
 *
 * El mismo shader se usa en:
 *   - el PREVIEW del generador (studio.js, con THREE global), y
 *   - el AR del escáner (living-tattoo.js, con AFRAME.THREE),
 * vía buildMaterial(THREE, texture, opts) -> THREE.ShaderMaterial.
 */
(function () {
  const VERTEX = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Cabecera común: muestreo de la imagen respetando la silueta.
  const HEADER = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D map;
    uniform float time;
    uniform float uOpacity;   // opacidad global
    uniform float uAppear;    // 0..1 aparición al detectar
    uniform float p1;         // parametro 1 (ver metadata por efecto)
    uniform float p2;         // parametro 2
    uniform vec3  accent;     // color de acento
    uniform int   useMaskLuma;// 1 = derivar silueta del luma (imagen sin alpha)

    float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(41.0, 289.0))) * 43758.5453); }

    vec4 baseSample(vec2 uv){
      vec4 t = texture2D(map, uv);
      float a = t.a;
      if (useMaskLuma == 1) { a = smoothstep(0.06, 0.22, luma(t.rgb)); }
      return vec4(t.rgb, a);
    }
  `;

  const FOOTER = `
    void main(){
      vec4 col = effect();
      col.a *= uAppear * uOpacity;
      if (col.a < 0.01) discard;
      gl_FragColor = col;
    }
  `;

  // Cuerpos de efecto. Cada uno define vec4 effect().
  const BODIES = {
    "glow-pulse": `
      vec4 effect(){
        vec4 b = baseSample(vUv);
        float pulse = 0.5 + 0.5 * sin(time * p1 * 3.14159);
        vec3 glow = accent * pulse * p2;
        // Brilla tanto en trazos claros como en tinta negra (antes la tinta negra quedaba sin efecto).
        float l = luma(b.rgb);
        vec3 rgb = b.rgb + glow * (0.3 + 0.7 * abs(2.0 * l - 1.0));
        return vec4(rgb, b.a);
      }
    `,
    "shimmer": `
      vec4 effect(){
        vec4 b = baseSample(vUv);
        float sweep = sin((vUv.x + vUv.y) * 3.0 - time * p1 * 2.0);
        float band = smoothstep(0.6, 1.0, sweep);
        vec3 rgb = mix(b.rgb, b.rgb + accent, band * p2);
        return vec4(rgb, b.a);
      }
    `,
    "ripple": `
      vec4 effect(){
        vec2 uv = vUv;
        float d = distance(uv, vec2(0.5));
        uv += (uv - 0.5) * sin(d * 22.0 - time * p1 * 3.0) * 0.012 * p2;
        vec4 b = baseSample(uv);
        return b;
      }
    `,
    "embers": `
      vec4 effect(){
        vec4 b = baseSample(vUv);
        vec2 g = vUv * vec2(20.0, 26.0);
        vec2 id = floor(g);
        float rnd = hash(id);
        float ph = fract(time * 0.25 * p1 + rnd);
        vec2 cell = fract(g) - vec2(0.5, ph);
        float spark = smoothstep(0.14, 0.0, length(cell)) * step(0.72, rnd);
        vec3 rgb = b.rgb + accent * spark * p2 * 2.0;
        return vec4(rgb, b.a);
      }
    `,
    // Energía que recorre SOLO la tinta del tatuaje (oscuro + desaturado).
    // Deja la piel intacta (transparente): se ve el tatuaje real "vivo".
    "ink-energy": `
      vec4 effect(){
        vec4 tx = texture2D(map, vUv);
        float l = luma(tx.rgb);
        float mx = max(max(tx.r, tx.g), tx.b);
        float mn = min(min(tx.r, tx.g), tx.b);
        float sat = mx <= 0.001 ? 0.0 : (mx - mn) / mx;
        // máscara SELECTIVA de tinta: solo pixeles bien oscuros y poco saturados.
        // (× alpha: en un PNG transparente el fondo es negro puro y no debe contar como tinta)
        float ink = smoothstep(0.52, 0.22, l) * (1.0 - sat * 0.5) * tx.a;
        ink = clamp(ink * p2, 0.0, 1.0);
        // vignette: apagar bordes (evita piso/piel de las esquinas)
        float vig = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x)
                  * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
        ink *= vig;
        // energía animada: pulso + flujo recorriendo el trazo
        float pulse = 0.6 + 0.4 * sin(time * p1 * 3.14159);
        float flow = 0.55 + 0.45 * sin((vUv.x + vUv.y) * 16.0 - time * p1 * 3.5);
        float glow = ink * pulse * flow * 1.6;
        return vec4(accent + glow * 0.15, glow);
      }
    `,
  };

  // Metadata para la UI del generador (labels y rangos de los sliders).
  const LIST = [
    { id: "glow-pulse", name: "Pulso de energía",
      p1: { label: "Velocidad", min: 0.2, max: 3, default: 1 },
      p2: { label: "Intensidad", min: 0, max: 2, default: 0.9 },
      accent: "#c8f560" },
    { id: "shimmer", name: "Destello",
      p1: { label: "Velocidad", min: 0.5, max: 6, default: 2.5 },
      p2: { label: "Fuerza", min: 0, max: 1.5, default: 0.8 },
      accent: "#c8f560" },
    { id: "ripple", name: "Ondas líquidas",
      p1: { label: "Velocidad", min: 0.3, max: 4, default: 1.4 },
      p2: { label: "Amplitud", min: 0.2, max: 3, default: 1.2 },
      accent: "#c8f560" },
    { id: "embers", name: "Brasas / partículas",
      p1: { label: "Velocidad", min: 0.3, max: 3, default: 1.2 },
      p2: { label: "Brillo", min: 0.2, max: 2.5, default: 1.3 },
      accent: "#c8f560" },
    { id: "ink-energy", name: "Energía en la tinta (sobre tu tatuaje)",
      p1: { label: "Velocidad", min: 0.3, max: 3, default: 1.2 },
      p2: { label: "Sensibilidad", min: 0.5, max: 2.5, default: 1.2 },
      accent: "#c8f560" },
  ];

  function buildFragment(id) {
    const body = BODIES[id] || BODIES["glow-pulse"];
    return HEADER + body + FOOTER;
  }

  function buildMaterial(THREE, texture, opts) {
    opts = opts || {};
    const meta = LIST.find((e) => e.id === opts.effect) || LIST[0];
    return new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        map: { value: texture },
        time: { value: 0 },
        uOpacity: { value: opts.opacity ?? 1 },
        uAppear: { value: opts.appear ?? 1 },
        p1: { value: opts.p1 ?? meta.p1.default },
        p2: { value: opts.p2 ?? meta.p2.default },
        accent: { value: new THREE.Color(opts.accent || meta.accent) },
        useMaskLuma: { value: opts.useMaskLuma ? 1 : 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: buildFragment(opts.effect),
    });
  }

  window.TattooEffects = { VERTEX, LIST, buildFragment, buildMaterial };
})();
