/* Tattoo AR — códigos telefónicos internacionales (selector de país). */
(function () {
  "use strict";
  var C = [
    { c: "VE", d: "+58", f: "🇻🇪", n: "Venezuela" },
    { c: "CO", d: "+57", f: "🇨🇴", n: "Colombia" },
    { c: "MX", d: "+52", f: "🇲🇽", n: "México" },
    { c: "AR", d: "+54", f: "🇦🇷", n: "Argentina" },
    { c: "CL", d: "+56", f: "🇨🇱", n: "Chile" },
    { c: "PE", d: "+51", f: "🇵🇪", n: "Perú" },
    { c: "EC", d: "+593", f: "🇪🇨", n: "Ecuador" },
    { c: "BO", d: "+591", f: "🇧🇴", n: "Bolivia" },
    { c: "UY", d: "+598", f: "🇺🇾", n: "Uruguay" },
    { c: "PY", d: "+595", f: "🇵🇾", n: "Paraguay" },
    { c: "BR", d: "+55", f: "🇧🇷", n: "Brasil" },
    { c: "PA", d: "+507", f: "🇵🇦", n: "Panamá" },
    { c: "CR", d: "+506", f: "🇨🇷", n: "Costa Rica" },
    { c: "GT", d: "+502", f: "🇬🇹", n: "Guatemala" },
    { c: "SV", d: "+503", f: "🇸🇻", n: "El Salvador" },
    { c: "HN", d: "+504", f: "🇭🇳", n: "Honduras" },
    { c: "NI", d: "+505", f: "🇳🇮", n: "Nicaragua" },
    { c: "DO", d: "+1", f: "🇩🇴", n: "Rep. Dominicana" },
    { c: "PR", d: "+1", f: "🇵🇷", n: "Puerto Rico" },
    { c: "CU", d: "+53", f: "🇨🇺", n: "Cuba" },
    { c: "ES", d: "+34", f: "🇪🇸", n: "España" },
    { c: "US", d: "+1", f: "🇺🇸", n: "Estados Unidos" },
    { c: "CA", d: "+1", f: "🇨🇦", n: "Canadá" },
    { c: "IT", d: "+39", f: "🇮🇹", n: "Italia" },
    { c: "FR", d: "+33", f: "🇫🇷", n: "Francia" },
    { c: "DE", d: "+49", f: "🇩🇪", n: "Alemania" },
    { c: "PT", d: "+351", f: "🇵🇹", n: "Portugal" },
    { c: "GB", d: "+44", f: "🇬🇧", n: "Reino Unido" }
  ];
  var byCode = {};
  C.forEach(function (x) { byCode[x.c] = x; });

  window.TA_COUNTRIES = C;
  window.TA_COUNTRY = function (code) { return byCode[code] || null; };
  // Rellena un <select> con las opciones (valor = ISO). def = ISO por defecto.
  window.TA_fillDialSelect = function (sel, def) {
    if (!sel) return;
    sel.innerHTML = C.map(function (x) {
      return '<option value="' + x.c + '">' + x.f + " " + x.d + "</option>";
    }).join("");
    sel.value = def || "CO";
  };
  // Dial code (ej. "+58") de un ISO.
  window.TA_dial = function (code) { var x = byCode[code]; return x ? x.d : ""; };
})();
