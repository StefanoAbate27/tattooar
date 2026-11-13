/* Tattoo AR — login/registro completo + captcha + saludo → generador */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var mode = "login", captchaOk = false;
  var tabLogin = $("tab-login"), tabSignup = $("tab-signup");
  var signupFields = $("signup-fields"), captcha = $("captcha");
  var submit = $("auth-submit"), sub = $("auth-sub"), msg = $("auth-msg"), form = $("auth-form");

  function setMode(m) {
    mode = m;
    tabLogin.classList.toggle("active", m === "login");
    tabSignup.classList.toggle("active", m === "signup");
    signupFields.hidden = m !== "signup";
    captcha.hidden = m !== "signup";
    submit.textContent = m === "login" ? "Entrar" : "Crear cuenta";
    sub.textContent = m === "login"
      ? "Accede a tu estudio para crear experiencias AR."
      : "Crea tu cuenta de tatuador. Un administrador validará tu pago y activará tu plan.";
    $("f-pass").setAttribute("autocomplete", m === "login" ? "current-password" : "new-password");
    msg.textContent = ""; msg.style.color = "";
    if (m === "signup" && window.__resetCaptcha) window.__resetCaptcha();
  }
  tabLogin.addEventListener("click", function () { setMode("login"); });
  tabSignup.addEventListener("click", function () { setMode("signup"); });
  if (window.TA_fillDialSelect) window.TA_fillDialSelect($("f-phone-cc"), "CO");

  // Si ya hay sesión y está aprobado, ir al generador.
  (async function () {
    try {
      var s = await window.taAuth.session();
      if (!s) return;
      var p = await window.taAuth.profile();
      if (p && (p.role === "admin" || p.status === "approved")) location.replace(p.role === "admin" ? "admin.html" : "studio.html");
    } catch (e) {}
  })();

  /* ---- Captcha deslizable (verificación humana propia) ---- */
  (function initCaptcha() {
    var track = $("captchaTrack"), handle = $("captchaHandle"), fill = $("captchaFill"), text = $("captchaText");
    var dragging = false, startX = 0, max = 0;
    function reset() { captchaOk = false; handle.style.left = "4px"; fill.style.width = "0px"; text.textContent = "Deslizá para verificar que sos humano"; track.classList.remove("done"); }
    window.__resetCaptcha = reset;
    function complete() { captchaOk = true; dragging = false; handle.style.left = max + "px"; fill.style.width = max + "px"; text.textContent = "✓ Verificado"; track.classList.add("done"); }
    handle.addEventListener("pointerdown", function (e) {
      if (captchaOk) return; dragging = true; startX = e.clientX - handle.offsetLeft;
      max = track.clientWidth - handle.offsetWidth - 8; try { handle.setPointerCapture(e.pointerId); } catch (_) {}
    });
    handle.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var x = Math.max(4, Math.min(max, e.clientX - startX));
      handle.style.left = x + "px"; fill.style.width = x + "px";
      if (x >= max - 3) complete();
    });
    handle.addEventListener("pointerup", function () { if (dragging && !captchaOk) { handle.style.left = "4px"; fill.style.width = "0px"; } dragging = false; });
  })();

  // El saludo se reproduce YA DENTRO del destino (js/welcome.js): guardamos el nombre
  // y navegamos, así al deslizar hacia arriba el usuario ya está en el dashboard/generador.
  function greetAndGo(firstName, dest) {
    try { sessionStorage.setItem("ta:welcome", JSON.stringify({ name: firstName || "" })); } catch (e) {}
    location.replace(dest || "studio.html");
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    msg.textContent = ""; msg.style.color = "";
    var email = $("f-email").value.trim(), pass = $("f-pass").value;
    if (!window.taAuth.client()) { msg.textContent = "No se pudo conectar con el servidor."; return; }
    submit.disabled = true; var label = submit.textContent; submit.textContent = "…";
    try {
      if (mode === "signup") {
        var first = $("f-first").value.trim(), last = $("f-last").value.trim();
        if (!first) { msg.textContent = "Escribí tu nombre."; return finish("Crear cuenta"); }
        if (!captchaOk) { msg.textContent = "Completá la verificación deslizando el control."; return finish("Crear cuenta"); }
        var meta = { first_name: first, last_name: last, phone: $("f-phone").value.trim(), phone_country: $("f-phone-cc").value, location: $("f-location").value.trim(), studio_name: $("f-studio").value.trim() };
        var r = await window.taAuth.signUp(email, pass, meta);
        if (r.error) { msg.textContent = traducirError(r.error.message); return finish("Crear cuenta"); }
        // Si la cuenta quedó aprobada (primer usuario o pre-autorizada), saludar y entrar.
        if (r.data && r.data.session) {
          var prof = await window.taAuth.profile();
          if (prof && (prof.role === "admin" || prof.status === "approved")) { greetAndGo(first, prof.role === "admin" ? "admin.html" : "studio.html"); return; }
        }
        // Si no, queda pendiente de aprobación.
        try { await window.taAuth.signOut(); } catch (_) {}
        msg.style.color = "var(--green)";
        msg.innerHTML = "✓ ¡Cuenta creada! Un administrador validará tu pago y activará tu cuenta. Te avisaremos para que empieces a crear AR.";
        setMode("login"); finish("Entrar"); return;
      } else {
        var r2 = await window.taAuth.signIn(email, pass);
        if (r2.error) { msg.textContent = traducirError(r2.error.message); return finish("Entrar"); }
        var prof = await window.taAuth.profile();
        if (prof && (prof.role === "admin" || prof.status === "approved")) {
          greetAndGo(window.taAuth.firstName(prof && prof.full_name), prof.role === "admin" ? "admin.html" : "studio.html");
        } else if (prof && prof.status === "rejected") {
          try { await window.taAuth.signOut(); } catch (_) {}
          msg.textContent = "Tu solicitud fue rechazada. Escríbenos para más información.";
          finish("Entrar");
        } else {
          try { await window.taAuth.signOut(); } catch (_) {}
          msg.style.color = "var(--green)";
          msg.innerHTML = "Tu cuenta está <b>pendiente de aprobación</b>. Un administrador la activará tras validar tu pago.";
          finish("Entrar");
        }
      }
    } catch (err) { msg.textContent = "Error inesperado. Reintenta."; finish(mode === "login" ? "Entrar" : "Crear cuenta"); }
    function finish(t) { submit.disabled = false; submit.textContent = t; }
  });

  window.__taGreet = greetAndGo; // QA: previsualizar el saludo sin login

  function traducirError(m) {
    m = m || "";
    if (/invalid login credentials/i.test(m)) return "Email o contraseña incorrectos.";
    if (/already registered/i.test(m)) return "Ese email ya tiene una cuenta.";
    if (/email not confirmed/i.test(m)) return "Confirma tu email antes de entrar.";
    if (/password should be at least/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
    return m;
  }
})();
