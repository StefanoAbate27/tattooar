/**
 * living-tattoo — componente A-Frame que da vida al tatuaje en AR.
 *
 * - Aplica un efecto de effects.js sobre la imagen del tatuaje, recortado a su
 *   silueta (alpha del PNG, o luma si no tiene alpha).
 * - Aparición "mágica" al detectar: fade-in + pequeño pop de escala.
 * - Estallido de partículas (THREE.Points) en el momento de la detección.
 *
 * Propiedades:
 *   src         : selector del <img> del tatuaje (ej "#art")
 *   effect      : id de efecto (glow-pulse | shimmer | ripple | embers)
 *   p1, p2      : parámetros del efecto
 *   accent      : color de acento
 *   useMaskLuma : true si la imagen no tiene alpha (deriva silueta del luma)
 *   opacity     : opacidad global
 */
AFRAME.registerComponent("living-tattoo", {
  schema: {
    src: { type: "selector" },
    effect: { type: "string", default: "glow-pulse" },
    p1: { type: "number", default: 1 },
    p2: { type: "number", default: 0.9 },
    accent: { type: "color", default: "#c8f560" },
    useMaskLuma: { type: "boolean", default: false },
    opacity: { type: "number", default: 1 },
  },

  init: function () {
    const THREE = AFRAME.THREE;
    this.appear = 0; // 0..1 progreso de aparición

    const img = this.data.src;
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    const markReady = () => { tex.needsUpdate = true; };
    if (img && img.complete && img.naturalWidth) markReady();
    else if (img) img.addEventListener("load", markReady, { once: true });

    this.material = window.TattooEffects.buildMaterial(THREE, tex, {
      effect: this.data.effect,
      p1: this.data.p1,
      p2: this.data.p2,
      accent: this.data.accent,
      useMaskLuma: this.data.useMaskLuma,
      opacity: this.data.opacity,
      appear: 0,
    });

    this.applyMaterial();
    this.el.addEventListener("object3dset", this.applyMaterial.bind(this));

    this.buildParticles();

    // Eventos de detección vienen del a-entity padre con mindar-image-target.
    const targetEl = this.el.closest("[mindar-image-target]") || this.el.parentEl;
    this.targetEl = targetEl;
    targetEl.addEventListener("targetFound", this.onFound.bind(this));
    targetEl.addEventListener("targetLost", this.onLost.bind(this));
    // El escáner arma el contenido al detectar: si el target ya está a la vista, arranca visible.
    if (targetEl.__taFound) this.onFound();
  },

  applyMaterial: function () {
    const mesh = this.el.getObject3D("mesh");
    if (mesh && this.material) mesh.material = this.material;
  },

  buildParticles: function () {
    const THREE = AFRAME.THREE;
    const N = 90;
    const positions = new Float32Array(N * 3);
    this.velocities = [];
    for (let i = 0; i < N; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 2] = 0;
      this.velocities.push([
        (Math.random() - 0.5) * 0.9,
        Math.random() * 1.2 + 0.2,
        (Math.random() - 0.5) * 0.4,
      ]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(this.data.accent),
      size: 0.03,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.visible = false;
    this.particleLife = 0;
    this.el.sceneEl.object3D; // ensure scene ready
    this.el.setObject3D("particles", this.points);
  },

  onFound: function () {
    this.appearing = true;
    // dispara el estallido de partículas
    this.particleLife = 1.0;
    this.points.visible = true;
    this.resetParticles();
  },

  onLost: function () {
    this.appearing = false;
  },

  resetParticles: function () {
    const pos = this.points.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] = (Math.random() - 0.5) * 0.15;
      pos[i + 1] = (Math.random() - 0.5) * 0.15;
      pos[i + 2] = 0;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  },

  tick: function (t, dt) {
    const s = (dt || 16) / 1000;
    // tiempo del shader
    if (this.material) this.material.uniforms.time.value = t / 1000;

    // aparición suave (fade + pop)
    const target = this.appearing ? 1 : 0;
    this.appear += (target - this.appear) * Math.min(1, s * 6);
    if (this.material) this.material.uniforms.uAppear.value = this.appear;
    const pop = 0.96 + 0.04 * this.appear;
    this.el.object3D.scale.set(pop, pop, pop);

    // partículas
    if (this.particleLife > 0) {
      this.particleLife -= s * 1.4;
      const pos = this.points.geometry.attributes.position.array;
      for (let i = 0, v = 0; i < pos.length; i += 3, v++) {
        pos[i] += this.velocities[v][0] * s;
        pos[i + 1] += this.velocities[v][1] * s;
        pos[i + 2] += this.velocities[v][2] * s;
      }
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.material.opacity = Math.max(0, this.particleLife);
      if (this.particleLife <= 0) this.points.visible = false;
    }
  },
});
