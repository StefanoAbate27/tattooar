/**
 * keyed-video — componente A-Frame para CONTENIDO VIDEO en AR.
 *
 * Reproduce un video sobre el tatuaje quitándole el fondo en tiempo real por
 * shader (funciona en iOS y Android, sin necesidad de alpha-video). Pensado para
 * animaciones con fondo blanco (bocetos a lápiz): alpha = oscuridad del pixel.
 *
 * Modos de key:
 *   "luma-white" : quita el blanco; conserva el trazo (dark = opaco).
 *   "luma-black" : quita el negro (dark = transparente).
 *   "chroma"     : quita un color (verde/azul) por distancia.
 *   "none"       : usa el alpha propio del video (si lo tuviera).
 *
 * Props:
 *   src        : selector del <video>
 *   mode       : luma-white | luma-black | chroma | none
 *   gain       : ganancia del alpha (nitidez del recorte)
 *   threshold  : umbral (0..1) por debajo del cual se descarta
 *   keyColor   : color a quitar en modo chroma
 *   opacity    : opacidad global
 */
AFRAME.registerComponent("keyed-video", {
  schema: {
    src: { type: "selector" },
    mode: { type: "string", default: "luma-white" },
    white: { type: "number", default: 0.86 },   // umbral: por encima = papel (transparente)
    soft: { type: "number", default: 0.12 },     // ancho del borde suave (antialias del mate)
    contrast: { type: "number", default: 1.12 }, // realce para que el trazo "reviva"
    zoom: { type: "number", default: 1.0 },      // recorta el margen del video (dibujo más grande)
    offx: { type: "number", default: 0.0 },      // ajuste fino de encuadre del video (X)
    offy: { type: "number", default: 0.0 },      // ajuste fino de encuadre del video (Y)
    flipx: { type: "boolean", default: false },  // espejar horizontalmente
    threshold: { type: "number", default: 0.04 },
    keyColor: { type: "color", default: "#00ff00" },
    opacity: { type: "number", default: 1 },
  },

  init: function () {
    const THREE = AFRAME.THREE;
    this.appear = 0;
    this.appearing = false;

    const video = this.data.src;
    this.video = video;
    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    // Nitidez a ángulos oblicuos (clave para que se vea HD sobre la piel).
    const gl = this.el.sceneEl && this.el.sceneEl.renderer;
    tex.anisotropy = gl ? gl.capabilities.getMaxAnisotropy() : 8;

    const modeInt = { none: 0, "luma-white": 1, "luma-black": 2, chroma: 3 }[this.data.mode] ?? 1;

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        map: { value: tex },
        keyMode: { value: modeInt },
        white: { value: this.data.white },
        soft: { value: this.data.soft },
        contrast: { value: this.data.contrast },
        zoom: { value: this.data.zoom },
        off: { value: new THREE.Vector2(this.data.offx, this.data.offy) },
        flipx: { value: this.data.flipx ? 1 : 0 },
        threshold: { value: this.data.threshold },
        keyColor: { value: new THREE.Color(this.data.keyColor) },
        uAppear: { value: 0 },
        uOpacity: { value: this.data.opacity },
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D map;
        uniform int keyMode;
        uniform float white;
        uniform float soft;
        uniform float contrast;
        uniform float zoom;
        uniform vec2 off;
        uniform float flipx;
        uniform float threshold;
        uniform vec3 keyColor;
        uniform float uAppear;
        uniform float uOpacity;
        float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
        void main(){
          // zoom + offset + espejo del encuadre del video
          vec2 uv = (vUv - 0.5) / zoom + 0.5 + off;
          if (flipx > 0.5) uv.x = 1.0 - uv.x;
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
          vec4 t = texture2D(map, uv);
          vec3 rgb = clamp((t.rgb - 0.5) * contrast + 0.5, 0.0, 1.0); // realce de trazo
          float l = luma(t.rgb);
          float a = 1.0;
          // MATE con borde suave: dibujo opaco y sólido, papel fuera.
          if (keyMode == 1) { a = smoothstep(white, white - soft, l); }        // quita blanco
          else if (keyMode == 2) { a = smoothstep(1.0 - white, 1.0 - white + soft, l); } // quita negro
          else if (keyMode == 3) { a = smoothstep(soft, soft + 0.15, distance(t.rgb, keyColor)); }
          else { a = t.a; }
          if (a < threshold) discard;
          a *= uAppear * uOpacity;
          gl_FragColor = vec4(rgb, a);
        }
      `,
    });

    this.applyMaterial();
    this.el.addEventListener("object3dset", this.applyMaterial.bind(this));

    const targetEl = this.el.closest("[mindar-image-target]") || this.el.parentEl;
    const onFound = () => {
      this.appearing = true;
      video.play().catch((e) => console.warn("[keyed-video] autoplay:", e));
    };
    targetEl.addEventListener("targetFound", onFound);
    // El escáner arma el contenido al detectar: si el target ya está a la vista, arranca visible.
    if (targetEl.__taFound) onFound();
    targetEl.addEventListener("targetLost", () => {
      this.appearing = false;
      video.pause();
      // Reiniciar la animación desde el principio para la próxima detección.
      try { video.currentTime = 0; } catch (e) {}
      this.appear = 0;
      if (this.material) this.material.uniforms.uAppear.value = 0;
    });
  },

  applyMaterial: function () {
    const mesh = this.el.getObject3D("mesh");
    if (mesh && this.material) mesh.material = this.material;
  },

  tick: function (t, dt) {
    if (!this.material) return;
    const s = (dt || 16) / 1000;
    const target = this.appearing ? 1 : 0;
    this.appear += (target - this.appear) * Math.min(1, s * 6);
    this.material.uniforms.uAppear.value = this.appear;
  },
});
