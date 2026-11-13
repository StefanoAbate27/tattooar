/* Tattoo AR — guard del generador: requiere sesión de tatuador */
(async function () {
  "use strict";
  function reveal() { document.body.classList.remove("auth-pending"); }
  // Si Supabase no está cargado/configurado, no bloquear (modo sin backend).
  if (!window.taAuth || !window.taAuth.client()) { reveal(); return; }
  try {
    var ok = await window.taAuth.requireAuth("login.html");
    if (!ok) return; // redirige a login
    var prof = await window.taAuth.profile();
    // Gate: solo admin o cuentas aprobadas usan el generador.
    if (!prof || (prof.role !== "admin" && prof.status !== "approved")) {
      showPending(prof && prof.status);
      return;
    }
    reveal();
    var chip = document.getElementById("userChip");
    var name = document.getElementById("userName");
    var first = window.taAuth.firstName(prof && prof.full_name) || "tatuador";
    if (chip && name) { name.textContent = first; chip.hidden = false; }
    var artist = document.getElementById("studioArtist");
    if (artist) artist.textContent = first;
    var pbtn = document.getElementById("profileBtn");
    if (pbtn) {
      pbtn.hidden = false;
      pbtn.addEventListener("click", function () {
        if (window.taOpenProfile) window.taOpenProfile(function (p) {
          var f = window.taAuth.firstName(p && p.full_name) || "tatuador";
          if (name) name.textContent = f; if (artist) artist.textContent = f;
        });
      });
    }
    if (prof && prof.role === "admin") { var al = document.getElementById("adminLink"); if (al) al.hidden = false; }
    var lo = document.getElementById("logoutBtn");
    if (lo) lo.addEventListener("click", async function () { await window.taAuth.signOut(); location.href = "login.html"; });
  } catch (e) { reveal(); }

  function showPending(status) {
    var rejected = status === "rejected";
    var el = document.createElement("div");
    el.className = "gate-screen";
    el.innerHTML =
      '<div class="gate-card">' +
        '<div class="gate-ico">' + (rejected ? "✕" : "⏳") + '</div>' +
        '<h1>' + (rejected ? "Solicitud no aprobada" : "Cuenta en revisión") + '</h1>' +
        '<p>' + (rejected
          ? "Tu solicitud no fue aprobada. Escríbenos si crees que es un error."
          : "Tu cuenta está <b>pendiente de aprobación</b>. Un administrador la activará y te asignará tu plan tras validar tu pago.") + '</p>' +
        '<div class="gate-actions">' +
          '<button class="btn-ghost" id="gateProfile">Completar mi perfil</button>' +
          '<button class="btn-ghost" id="gateLogout">Cerrar sesión</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    document.body.classList.remove("auth-pending");
    var gp = document.getElementById("gateProfile");
    if (gp) gp.addEventListener("click", function () { if (window.taOpenProfile) window.taOpenProfile(); });
    var gl = document.getElementById("gateLogout");
    if (gl) gl.addEventListener("click", async function () { await window.taAuth.signOut(); location.href = "login.html"; });
    if (typeof gsap !== "undefined") gsap.from(".gate-card", { y: 24, opacity: 0, duration: 0.6, ease: "power3.out" });
  }
})();
