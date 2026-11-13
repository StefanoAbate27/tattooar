/* Tattoo AR — modal de edición de perfil completo. Reutilizable en studio y admin. */
(function () {
  "use strict";
  var built = false, onSavedCb = null, current = null, pendingAvatar = null;

  function setAvatar(url, initial) {
    var a = document.getElementById("taPfAvatar");
    if (!a) return;
    if (url) a.innerHTML = '<img src="' + url + '" alt="" />';
    else a.textContent = (initial || "·").toUpperCase();
  }
  async function uploadAvatar(file) {
    var c = window.taAuth.client();
    var ext = (file.name.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
    var path = "avatars/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
    var up = await c.storage.from("assets").upload(path, file, { contentType: file.type || "image/png", upsert: false });
    if (up.error) throw new Error(up.error.message);
    return c.storage.from("assets").getPublicUrl(path).data.publicUrl;
  }
  async function onAvatarPick() {
    var f = document.getElementById("taPfAvatarFile").files[0];
    if (!f) return;
    var msg = document.getElementById("taPfMsg");
    // preview inmediato
    var rd = new FileReader(); rd.onload = function () { setAvatar(rd.result); }; rd.readAsDataURL(f);
    try { msg.style.color = ""; msg.textContent = "Subiendo foto…"; pendingAvatar = await uploadAvatar(f); msg.textContent = ""; }
    catch (e) { msg.textContent = "No se pudo subir la foto: " + e.message; }
  }

  function build() {
    if (built) return;
    built = true;
    var wrap = document.createElement("div");
    wrap.className = "ta-modal-backdrop";
    wrap.id = "taProfileModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="ta-modal" role="dialog" aria-modal="true">' +
        '<div class="ta-modal-head"><h3>Editar perfil</h3><button class="ta-modal-x" id="taPfClose" aria-label="Cerrar">✕</button></div>' +
        '<div class="ta-avatar-wrap"><div class="ta-avatar-lg" id="taPfAvatar">·</div>' +
          '<button type="button" class="ta-avatar-edit" id="taPfAvatarBtn">Cambiar foto</button>' +
          '<input type="file" id="taPfAvatarFile" accept="image/*" hidden /></div>' +
        '<div class="field-row">' +
          '<label class="field-inline"><span>Nombres</span><input id="taPfFirst" type="text" placeholder="Ana" autocomplete="given-name" /></label>' +
          '<label class="field-inline"><span>Apellidos</span><input id="taPfLast" type="text" placeholder="Ríos" autocomplete="family-name" /></label>' +
        '</div>' +
        '<label class="field-inline"><span>Nombre del estudio</span><input id="taPfStudio" type="text" placeholder="Ink Studio" autocomplete="organization" /></label>' +
        '<label class="field-inline"><span>Teléfono</span><div class="phone-row"><select id="taPfPhoneCc" class="dial-select"></select><input id="taPfPhone" type="tel" placeholder="300 000 0000" autocomplete="tel-national" /></div></label>' +
        '<label class="field-inline"><span>Ubicación</span><input id="taPfLocation" type="text" placeholder="Bogotá, CO" autocomplete="address-level2" /></label>' +
        '<label class="field-inline"><span>Email</span><input id="taPfEmail" type="email" disabled /></label>' +
        '<div class="ta-modal-msg" id="taPfMsg"></div>' +
        '<div class="ta-modal-actions"><button class="btn-ghost" id="taPfCancel">Cancelar</button><button class="btn-primary" id="taPfSave">Guardar cambios</button></div>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
    document.getElementById("taPfClose").addEventListener("click", close);
    document.getElementById("taPfCancel").addEventListener("click", close);
    function refreshAvatar() {
      if (pendingAvatar || (current && current.avatar_url)) return; // no pisar la foto
      var f = document.getElementById("taPfFirst").value.trim();
      document.getElementById("taPfAvatar").textContent = (f[0] || "·").toUpperCase();
    }
    document.getElementById("taPfFirst").addEventListener("input", refreshAvatar);
    document.getElementById("taPfSave").addEventListener("click", save);
    document.getElementById("taPfAvatarBtn").addEventListener("click", function () { document.getElementById("taPfAvatarFile").click(); });
    document.getElementById("taPfAvatarFile").addEventListener("change", onAvatarPick);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !wrap.hidden) close(); });
  }

  function close() {
    var wrap = document.getElementById("taProfileModal");
    if (!wrap) return;
    if (window.gsap) {
      window.gsap.to(wrap.querySelector(".ta-modal"), { y: 14, opacity: 0, duration: 0.2, ease: "power2.in" });
      window.gsap.to(wrap, { opacity: 0, duration: 0.25, onComplete: function () { wrap.hidden = true; wrap.style.opacity = ""; } });
    } else { wrap.hidden = true; }
  }

  async function open(onSaved) {
    if (!window.taAuth || !window.taAuth.client()) { alert("Iniciá sesión para editar tu perfil."); return; }
    build();
    onSavedCb = onSaved || null;
    var s = await window.taAuth.session();
    if (!s) { location.href = "login.html"; return; }
    var prof = await window.taAuth.profile();
    current = { id: s.user.id, email: s.user.email, avatar_url: (prof && prof.avatar_url) || "" };
    pendingAvatar = null;
    var g = function (id) { return document.getElementById(id); };
    g("taPfFirst").value = (prof && prof.first_name) || "";
    g("taPfLast").value = (prof && prof.last_name) || "";
    g("taPfStudio").value = (prof && prof.studio_name) || "";
    g("taPfPhone").value = (prof && prof.phone) || "";
    if (window.TA_fillDialSelect) window.TA_fillDialSelect(g("taPfPhoneCc"), (prof && prof.phone_country) || "CO");
    g("taPfLocation").value = (prof && prof.location) || "";
    g("taPfEmail").value = current.email || "";
    setAvatar(current.avatar_url, (((prof && prof.first_name) || (prof && prof.full_name) || "·")[0] || "·"));
    g("taPfMsg").textContent = "";
    var wrap = g("taProfileModal");
    wrap.hidden = false;
    if (window.gsap) {
      window.gsap.fromTo(wrap, { opacity: 0 }, { opacity: 1, duration: 0.25 });
      window.gsap.fromTo(wrap.querySelector(".ta-modal"), { y: 18, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: "power3.out" });
    }
    setTimeout(function () { g("taPfFirst").focus(); }, 60);
  }

  async function save() {
    var g = function (id) { return document.getElementById(id); };
    var btn = g("taPfSave"), msg = g("taPfMsg");
    var meta = {
      first_name: g("taPfFirst").value.trim(), last_name: g("taPfLast").value.trim(),
      studio_name: g("taPfStudio").value.trim(), phone: g("taPfPhone").value.trim(),
      phone_country: g("taPfPhoneCc").value, location: g("taPfLocation").value.trim(),
      avatar_url: pendingAvatar || ""
    };
    if (!meta.first_name) { msg.style.color = ""; msg.textContent = "Escribí tu nombre."; return; }
    btn.disabled = true; var prev = btn.textContent; btn.textContent = "Guardando…"; msg.textContent = "";
    try {
      var r = await window.taAuth.updateMyProfile(meta);
      if (r && r.error) throw new Error(r.error.message);
      try { await window.taAuth.client().auth.updateUser({ data: { full_name: (meta.first_name + " " + meta.last_name).trim(), first_name: meta.first_name, last_name: meta.last_name, phone: meta.phone, location: meta.location, studio_name: meta.studio_name } }); } catch (e) {}
      msg.style.color = "var(--green)"; msg.textContent = "✓ Guardado";
      if (onSavedCb) { try { onSavedCb({ full_name: (meta.first_name + " " + meta.last_name).trim(), first_name: meta.first_name }); } catch (e) {} }
      setTimeout(close, 650);
    } catch (err) { msg.style.color = ""; msg.textContent = "No se pudo guardar: " + err.message; }
    finally { btn.disabled = false; btn.textContent = prev; }
  }

  window.taOpenProfile = open;
})();
