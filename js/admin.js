/* Tattoo AR — panel de admin (SaaS). Requiere rol admin. */
(async function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var money = function (n) { return "$" + (Math.round(n * 100) / 100).toLocaleString("es"); };
  function fmtDate(s) { try { return new Date(s).toLocaleDateString(); } catch (e) { return "—"; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }

  // Planes que ofreces a los tatuadores (modelo de negocio).
  var PLANS = {
    free: { label: "Free", price: 0, tag: "muted", desc: "Para probar el servicio. 1 diseño activo, con marca de agua." },
    pro: { label: "Pro", price: 19, tag: "green", desc: "Diseños ilimitados, sin marca de agua, estadísticas." },
    studio: { label: "Studio", price: 49, tag: "lilac", desc: "Multi-artista, dominio propio y soporte prioritario." }
  };

  // ---- Guard ----
  if (!window.taAuth || !window.taAuth.client()) { location.replace("login.html"); return; }
  if (!(await window.taAuth.requireAuth("login.html"))) return;
  var me = await window.taAuth.profile();
  if (!me || me.role !== "admin") { location.replace("studio.html"); return; }
  document.body.classList.remove("auth-pending");

  var first = window.taAuth.firstName(me.full_name) || "Admin";
  $("sideName").textContent = first;
  if (me.avatar_url) $("sideAvatar").innerHTML = '<img src="' + me.avatar_url + '" alt="" />';
  else $("sideAvatar").textContent = (first[0] || "A").toUpperCase();
  $("logoutBtn").addEventListener("click", async function () { await window.taAuth.signOut(); location.href = "login.html"; });
  function openProfile() { if (window.taOpenProfile) window.taOpenProfile(function (p) { var f = window.taAuth.firstName(p && p.full_name) || "Admin"; $("sideName").textContent = f; $("sideAvatar").textContent = (f[0] || "A").toUpperCase(); }); }
  var pbtn = $("profileBtn"); if (pbtn) pbtn.addEventListener("click", openProfile);
  var suser = document.querySelector(".side-user"); if (suser) { suser.style.cursor = "pointer"; suser.title = "Editar perfil"; suser.addEventListener("click", openProfile); }

  var sb = window.taAuth.client();

  // ---- Datos ----
  var profiles = [], designs = [];
  try {
    var pr = await sb.from("profiles").select("*").order("created_at", { ascending: true });
    profiles = pr.data || [];
    var dr = await sb.from("designs").select("*").order("created_at", { ascending: false });
    designs = dr.data || [];
  } catch (e) { console.error(e); }

  var nameById = {}, designsByOwner = {}, viewsByOwner = {};
  profiles.forEach(function (p) { nameById[p.id] = p.full_name || "—"; designsByOwner[p.id] = 0; viewsByOwner[p.id] = 0; });
  designs.forEach(function (d) {
    designsByOwner[d.owner] = (designsByOwner[d.owner] || 0) + 1;
    viewsByOwner[d.owner] = (viewsByOwner[d.owner] || 0) + (d.views || 0);
  });

  var totalViews = designs.reduce(function (a, d) { return a + (d.views || 0); }, 0);
  function planOf(p) { return PLANS[p.plan] ? p.plan : "free"; }
  var mrr = profiles.reduce(function (a, p) { return a + PLANS[planOf(p)].price; }, 0);
  var paying = profiles.filter(function (p) { return PLANS[planOf(p)].price > 0; }).length;

  // ================= RESUMEN (React + GSAP) =================
  var admins = profiles.filter(function (p) { return p.role === "admin"; }).length;
  var PLAN_COLORS = { free: "var(--muted)", pro: "var(--green)", studio: "var(--lilac)" };

  function monthsTrend() {
    var months = [], now = new Date();
    for (var i = 5; i >= 0; i--) { var d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ label: d.toLocaleDateString("es", { month: "short" }), value: 0, key: d.getFullYear() + "-" + d.getMonth() }); }
    var idx = {}; months.forEach(function (m, i2) { idx[m.key] = i2; });
    designs.forEach(function (dz) { var d = new Date(dz.created_at); var k = d.getFullYear() + "-" + d.getMonth(); if (k in idx) months[idx[k]].value++; });
    return months;
  }
  function revenueData() {
    var order = ["studio", "pro", "free"];
    var byPlan = {}; Object.keys(PLANS).forEach(function (k) { byPlan[k] = 0; });
    profiles.forEach(function (p) { byPlan[planOf(p)]++; });
    var m = Object.keys(PLANS).reduce(function (a, k) { return a + byPlan[k] * PLANS[k].price; }, 0);
    var segs = order.filter(function (k) { return byPlan[k] * PLANS[k].price > 0; }).map(function (k) {
      return { label: PLANS[k].label, value: byPlan[k] * PLANS[k].price, valueLabel: money(byPlan[k] * PLANS[k].price), color: PLAN_COLORS[k] };
    });
    if (!segs.length) segs = [{ label: "Sin ingresos aún", value: 1, valueLabel: money(0), color: "var(--line)" }];
    return { segments: segs, mrr: m, mrrLabel: money(m) };
  }
  function buildDashData() {
    var rev = revenueData();
    var vpd = designs.length ? Math.round(totalViews / designs.length) : 0;
    var pay = profiles.filter(function (p) { return PLANS[planOf(p)].price > 0; }).length;
    return {
      kpis: [
        { label: "Tatuadores", value: profiles.length, icon: "◇", foot: admins + (admins === 1 ? " admin" : " admins") },
        { label: "Diseños AR", value: designs.length, icon: "✦", foot: vpd + " vistas/diseño" },
        { label: "Vistas totales", value: totalViews, icon: "◎", foot: "acumuladas" },
        { label: "Ingresos mensuales", value: rev.mrr, prefix: "$", icon: "$", accent: true, foot: pay + " de pago" }
      ],
      trend: monthsTrend(),
      revenue: rev
    };
  }
  function pushDash() { var d = buildDashData(); window.__dashPending = d; if (window.TADash) window.TADash.render(d); }
  pushDash();

  // Top tatuadores por vistas
  (function () {
    var top = profiles.slice().sort(function (a, b) { return (viewsByOwner[b.id] || 0) - (viewsByOwner[a.id] || 0); }).slice(0, 5);
    var maxV = Math.max(1, viewsByOwner[top[0] ? top[0].id : 0] || 1);
    $("top-artists").innerHTML = top.length ? top.map(function (p) {
      var v = viewsByOwner[p.id] || 0, w = Math.round((v / maxV) * 100);
      return '<div class="rank-row"><span class="rank-name">' + esc(p.full_name || "—") + '</span><div class="rank-bar"><div class="rank-fill" style="width:' + Math.max(w, 4) + '%"></div></div><span class="rank-val">' + v.toLocaleString("es") + '</span></div>';
    }).join("") : '<p class="hint">Sin datos todavía.</p>';
  })();

  // Actividad reciente
  $("recent-body").innerHTML = designs.slice(0, 6).map(function (d) {
    return '<tr><td>' + esc(d.name || "Diseño") + '</td><td>' + esc(nameById[d.owner] || "—") + '</td><td><b>' + (d.views || 0) + '</b></td><td>' + fmtDate(d.created_at) + '</td></tr>';
  }).join("") || '<tr><td colspan="4" class="hint center">Aún no hay diseños.</td></tr>';

  // ================= DISEÑOS =================
  function renderDesigns(q) {
    q = (q || "").toLowerCase();
    var rows = designs.filter(function (d) {
      return !q || (d.name || "").toLowerCase().indexOf(q) >= 0 || (nameById[d.owner] || "").toLowerCase().indexOf(q) >= 0;
    });
    $("designs-count").textContent = rows.length + (rows.length === 1 ? " diseño" : " diseños");
    $("designs-body").innerHTML = rows.length ? rows.map(function (d) {
      var link = d.design_url ? '<a class="qr-link" href="' + esc(d.design_url) + '" target="_blank" rel="noopener">ver JSON</a>' : "—";
      return '<tr><td>' + esc(d.name || "Diseño") + '</td><td>' + esc(nameById[d.owner] || "—") + '</td><td><b>' + (d.views || 0) + '</b></td><td>' + fmtDate(d.created_at) + '</td><td class="right">' + link + '</td></tr>';
    }).join("") : '<tr><td colspan="5" class="hint center">Sin resultados.</td></tr>';
  }
  renderDesigns("");
  $("designs-search").addEventListener("input", function (e) { renderDesigns(e.target.value); });

  // ================= TATUADORES =================
  var STATUS = { approved: { label: "Aprobado", tag: "green" }, pending: { label: "Pendiente", tag: "orange" }, rejected: { label: "Rechazado", tag: "muted" } };
  function statusOf(p) { return p.status || "pending"; }
  function statusBadge(p) { var s = STATUS[statusOf(p)] || STATUS.pending; return '<span class="pill pill-' + s.tag + '">' + s.label + '</span>'; }
  function planSelect(p) {
    var cur = planOf(p);
    return '<select class="mini-select" data-plan-uid="' + p.id + '">' +
      Object.keys(PLANS).map(function (k) { return '<option value="' + k + '"' + (k === cur ? " selected" : "") + '>' + PLANS[k].label + '</option>'; }).join("") + '</select>';
  }
  function contactCell(p) {
    var bits = [];
    if (p.studio_name) bits.push(esc(p.studio_name));
    if (p.phone) bits.push(esc(p.phone));
    if (p.location) bits.push(esc(p.location));
    return bits.length ? '<div class="cell-contact">' + bits.join("<br>") + '</div>' : '<span class="hint">—</span>';
  }
  function artistActions(p, isMe) {
    if (isMe) return '<span class="hint">tú</span>';
    var out = [];
    if (statusOf(p) !== "approved") out.push('<button class="btn-primary tiny" data-approve="' + p.id + '">Aprobar</button>');
    if (statusOf(p) !== "rejected") out.push('<button class="btn-ghost tiny" data-reject="' + p.id + '">Rechazar</button>');
    out.push('<button class="btn-ghost tiny" data-role-uid="' + p.id + '" data-role="' + (p.role === "admin" ? "artist" : "admin") + '">' + (p.role === "admin" ? "Quitar admin" : "Hacer admin") + '</button>');
    return '<div class="row-actions">' + out.join("") + '</div>';
  }
  function renderPendingCallout() {
    var el = $("pending-callout"); if (!el) return;
    var pend = profiles.filter(function (p) { return statusOf(p) === "pending" && p.id !== me.id; });
    if (!pend.length) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<span class="pc-badge">' + pend.length + '</span><span>' + (pend.length > 1 ? "solicitudes pendientes" : "solicitud pendiente") +
      ' de aprobación. Valida el pago y asigna el plan antes de activar la cuenta.</span>';
  }
  function renderArtists(q) {
    q = (q || "").toLowerCase();
    var rows = profiles.filter(function (p) { return !q || (p.full_name || "").toLowerCase().indexOf(q) >= 0 || (p.studio_name || "").toLowerCase().indexOf(q) >= 0; });
    $("artists-count").textContent = rows.length + (rows.length === 1 ? " cuenta" : " cuentas");
    $("artists-body").innerHTML = rows.length ? rows.map(function (p) {
      var isMe = p.id === me.id;
      var nameTag = esc(p.full_name || "—") + (p.role === "admin" ? ' <span class="pill pill-green tiny-pill">admin</span>' : "");
      var av = p.avatar_url ? '<span class="mini-avatar"><img src="' + esc(p.avatar_url) + '" alt="" /></span>' : '<span class="mini-avatar">' + esc((p.full_name || "?")[0] || "?").toUpperCase() + '</span>';
      return '<tr><td><div class="cell-user">' + av + '<div>' + nameTag + '</div></div></td>' +
        '<td>' + contactCell(p) + '</td>' +
        '<td>' + planSelect(p) + '</td>' +
        '<td>' + statusBadge(p) + '</td>' +
        '<td>' + (designsByOwner[p.id] || 0) + '</td>' +
        '<td><b>' + (viewsByOwner[p.id] || 0).toLocaleString("es") + '</b></td>' +
        '<td class="right">' + artistActions(p, isMe) + '</td></tr>';
    }).join("") : '<tr><td colspan="7" class="hint center">Sin tatuadores.</td></tr>';
    renderPendingCallout();
  }
  renderArtists("");
  $("artists-search").addEventListener("input", function (e) { renderArtists(e.target.value); });

  // Crear / autorizar cuenta (pre-aprobación por email)
  var paBtn = $("pa-btn");
  if (paBtn) paBtn.addEventListener("click", async function () {
    var email = ($("pa-email").value || "").trim(), plan = $("pa-plan").value, msg = $("pa-msg");
    if (!/.+@.+\..+/.test(email)) { msg.style.color = ""; msg.textContent = "Escribí un email válido."; return; }
    paBtn.disabled = true; var prev = paBtn.textContent; paBtn.textContent = "…";
    var r = await sb.rpc("preauthorize", { p_email: email, p_plan: plan });
    paBtn.disabled = false; paBtn.textContent = prev;
    if (r.error) { msg.style.color = ""; msg.textContent = "No se pudo: " + r.error.message; return; }
    msg.style.color = "var(--green)";
    msg.innerHTML = "✓ <b>" + email + "</b> autorizado con plan " + PLANS[plan].label + ". Al registrarse quedará activo.";
    $("pa-email").value = "";
  });

  async function doApprove(btn, uid, status) {
    var row = btn.closest("tr");
    var sel = row.querySelector("select[data-plan-uid]");
    var plan = sel ? sel.value : "free";
    if (status === "approved" && !confirm('¿Confirmas que validaste el pago del plan "' + PLANS[plan].label + '" y querés ACTIVAR esta cuenta?')) return;
    if (status === "rejected" && !confirm("¿Rechazar esta solicitud?")) return;
    btn.disabled = true; var prev = btn.textContent; btn.textContent = "…";
    var r = await sb.rpc("approve_artist", { uid: uid, new_plan: plan, new_status: status });
    if (r.error) { btn.disabled = false; btn.textContent = prev; alert("No se pudo: " + r.error.message); return; }
    var p = profiles.find(function (x) { return x.id === uid; });
    if (p) { p.status = status; p.plan = plan; }
    renderArtists($("artists-search").value); recomputeRevenue();
  }
  $("artists-body").addEventListener("click", async function (e) {
    var ap = e.target.closest("button[data-approve]");
    var rj = e.target.closest("button[data-reject]");
    var rl = e.target.closest("button[data-role-uid]");
    if (ap) return doApprove(ap, ap.dataset.approve, "approved");
    if (rj) return doApprove(rj, rj.dataset.reject, "rejected");
    if (rl) {
      rl.disabled = true; var prev = rl.textContent; rl.textContent = "…";
      var r = await sb.rpc("set_role", { uid: rl.dataset.roleUid, new_role: rl.dataset.role });
      if (r.error) { rl.disabled = false; rl.textContent = prev; alert("No se pudo cambiar el rol: " + r.error.message); return; }
      var p = profiles.find(function (x) { return x.id === rl.dataset.roleUid; }); if (p) p.role = rl.dataset.role;
      renderArtists($("artists-search").value); pushDash();
    }
  });
  $("artists-body").addEventListener("change", async function (e) {
    var sel = e.target.closest("select[data-plan-uid]");
    if (!sel) return;
    sel.disabled = true;
    var r = await sb.rpc("set_plan", { uid: sel.dataset.planUid, new_plan: sel.value });
    sel.disabled = false;
    if (r.error) { alert("No se pudo cambiar el plan: " + r.error.message); return; }
    // Actualiza en memoria y refresca ingresos
    var p = profiles.find(function (x) { return x.id === sel.dataset.planUid; });
    if (p) p.plan = sel.value;
    recomputeRevenue();
  });

  // ================= INGRESOS =================
  function recomputeRevenue() {
    var byPlan = {}; Object.keys(PLANS).forEach(function (k) { byPlan[k] = 0; });
    profiles.forEach(function (p) { byPlan[planOf(p)]++; });
    var m = Object.keys(PLANS).reduce(function (a, k) { return a + byPlan[k] * PLANS[k].price; }, 0);
    var pay = Object.keys(PLANS).reduce(function (a, k) { return a + (PLANS[k].price > 0 ? byPlan[k] : 0); }, 0);
    $("r-mrr").textContent = money(m);
    $("r-arr").textContent = money(m * 12);
    $("r-paying").textContent = pay;
    $("r-paying-foot").textContent = "de " + profiles.length + " tatuadores";
    $("r-arpu").textContent = money(profiles.length ? m / profiles.length : 0);

    $("revenue-body").innerHTML = Object.keys(PLANS).map(function (k) {
      return '<tr><td><span class="pill pill-' + PLANS[k].tag + '">' + PLANS[k].label + '</span></td><td>' + money(PLANS[k].price) + '</td><td>' + byPlan[k] + '</td><td><b>' + money(byPlan[k] * PLANS[k].price) + '</b></td></tr>';
    }).join("") + '<tr class="total-row"><td>Total</td><td></td><td>' + profiles.length + '</td><td><b>' + money(m) + '</b></td></tr>';
    pushDash(); // refresca KPIs + gráficas React
  }
  recomputeRevenue();

  // ================= AJUSTES =================
  $("plan-cards").innerHTML = Object.keys(PLANS).map(function (k) {
    var pl = PLANS[k];
    return '<div class="plan-card tag-' + pl.tag + '"><span class="pill pill-' + pl.tag + '">' + pl.label + '</span>' +
      '<div class="plan-price">' + money(pl.price) + '<span>/mes</span></div><p class="hint">' + pl.desc + '</p></div>';
  }).join("");

  // ================= Navegación lateral =================
  var VIEWS = {
    overview: { title: "Resumen", sub: "Estado general del estudio en tiempo real." },
    designs: { title: "Diseños", sub: "Todas las experiencias AR publicadas." },
    artists: { title: "Tatuadores", sub: "Gestiona cuentas, planes y permisos." },
    revenue: { title: "Ingresos", sub: "Suscripciones y proyección de ingresos." },
    settings: { title: "Ajustes", sub: "Planes del servicio y modelo de negocio." }
  };
  function show(view) {
    document.querySelectorAll("[data-panel]").forEach(function (s) { s.hidden = s.dataset.panel !== view; });
    document.querySelectorAll(".nav-item[data-view]").forEach(function (b) { b.classList.toggle("active", b.dataset.view === view); });
    $("viewTitle").textContent = VIEWS[view].title;
    $("viewSub").textContent = VIEWS[view].sub;
    closeSidebar();
    if (typeof gsap !== "undefined" && !document.hidden) {
      gsap.fromTo(".admin-content > section:not([hidden]) > *", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: "power3.out", clearProps: "opacity,transform" });
    }
    try { history.replaceState(null, "", "#" + view); } catch (e) {}
  }
  $("nav").addEventListener("click", function (e) { var b = e.target.closest(".nav-item[data-view]"); if (b) show(b.dataset.view); });
  var initial = (location.hash || "").replace("#", "");
  show(VIEWS[initial] ? initial : "overview");

  // Sidebar móvil
  function openSidebar() { $("sidebar").classList.add("open"); $("scrim").classList.add("show"); }
  function closeSidebar() { $("sidebar").classList.remove("open"); $("scrim").classList.remove("show"); }
  $("hamburger").addEventListener("click", openSidebar);
  $("scrim").addEventListener("click", closeSidebar);

  // Entrada
  if (typeof gsap !== "undefined" && !document.hidden) {
    gsap.from(".sidebar", { x: -20, opacity: 0, duration: 0.5, ease: "power3.out" });
    gsap.from(".kpi", { y: 16, opacity: 0, duration: 0.5, stagger: 0.07, delay: 0.1, ease: "power3.out", clearProps: "opacity,transform" });
  }
})();
