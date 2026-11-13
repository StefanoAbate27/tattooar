/* Tattoo AR — tema + idioma para generador y escáner (coherente con la landing) */
(function () {
  "use strict";
  var T = {
    // Escáner
    "Apunta la cámara a tu tatuaje y mira cómo cobra vida.": { en: "Point the camera at your tattoo and watch it come alive.", pt: "Aponte a câmera para a sua tatuagem e veja-a ganhar vida.", fr: "Pointez la caméra vers votre tatouage et regardez-le prendre vie.", de: "Richte die Kamera auf dein Tattoo und sieh es zum Leben erwachen." },
    "Cargando diseño…": { en: "Loading design…", pt: "Carregando design…", fr: "Chargement du design…", de: "Design wird geladen…" },
    "Requiere permiso de cámara y HTTPS.": { en: "Requires camera permission and HTTPS.", pt: "Requer permissão de câmera e HTTPS.", fr: "Nécessite l'autorisation de la caméra et HTTPS.", de: "Erfordert Kamerazugriff und HTTPS." },
    "Apunta la cámara al tatuaje": { en: "Point the camera at the tattoo", pt: "Aponte a câmera para a tatuagem", fr: "Pointez la caméra vers le tatouage", de: "Richte die Kamera auf das Tattoo" },
    // Generador
    "Elegir imagen": { en: "Choose image", pt: "Escolher imagem", fr: "Choisir une image", de: "Bild wählen" },
    "Subí la imagen del tatuaje": { en: "Upload the tattoo image", pt: "Envie a imagem da tatuagem", fr: "Importez l'image du tatouage", de: "Tattoo-Bild hochladen" },
    "PNG con fondo transparente = mejor resultado. También sirve JPG/PNG con fondo sólido.": { en: "PNG with transparent background = best result. JPG/PNG with a solid background also works.", pt: "PNG com fundo transparente = melhor resultado. JPG/PNG com fundo sólido também funciona.", fr: "PNG à fond transparent = meilleur résultat. Un JPG/PNG à fond uni fonctionne aussi.", de: "PNG mit transparentem Hintergrund = bestes Ergebnis. JPG/PNG mit einfarbigem Hintergrund geht auch." },
    "1 · Contenido que cobra vida": { en: "1 · Content that comes alive", pt: "1 · Conteúdo que ganha vida", fr: "1 · Contenu qui prend vie", de: "1 · Inhalt, der lebendig wird" },
    "Efecto de la imagen": { en: "Image effect", pt: "Efeito da imagem", fr: "Effet de l'image", de: "Bildeffekt" },
    "Video propio": { en: "Your own video", pt: "Vídeo próprio", fr: "Votre vidéo", de: "Eigenes Video" },
    "Velocidad": { en: "Speed", pt: "Velocidade", fr: "Vitesse", de: "Geschwindigkeit" },
    "Intensidad": { en: "Intensity", pt: "Intensidade", fr: "Intensité", de: "Intensität" },
    "Color de acento": { en: "Accent color", pt: "Cor de destaque", fr: "Couleur d'accent", de: "Akzentfarbe" },
    "Subí tu animación (mp4/webm). El fondo se recorta en vivo en la cámara del cliente.": { en: "Upload your animation (mp4/webm). The background is keyed out live on the client's camera.", pt: "Envie sua animação (mp4/webm). O fundo é removido ao vivo na câmera do cliente.", fr: "Importez votre animation (mp4/webm). Le fond est détouré en direct sur la caméra du client.", de: "Lade deine Animation hoch (mp4/webm). Der Hintergrund wird live auf der Kamera des Kunden entfernt." },
    "Elegir video": { en: "Choose video", pt: "Escolher vídeo", fr: "Choisir une vidéo", de: "Video wählen" },
    "Quitar fondo": { en: "Remove background", pt: "Remover fundo", fr: "Retirer le fond", de: "Hintergrund entfernen" },
    "Blanco (bocetos)": { en: "White (sketches)", pt: "Branco (esboços)", fr: "Blanc (croquis)", de: "Weiß (Skizzen)" },
    "Negro": { en: "Black", pt: "Preto", fr: "Noir", de: "Schwarz" },
    "Verde/Croma": { en: "Green/Chroma", pt: "Verde/Croma", fr: "Vert/Chroma", de: "Grün/Chroma" },
    "Ya es transparente": { en: "Already transparent", pt: "Já é transparente", fr: "Déjà transparent", de: "Bereits transparent" },
    "Solidez del trazo": { en: "Stroke solidity", pt: "Solidez do traço", fr: "Solidité du trait", de: "Strichdeckung" },
    "2 · Generar diseño AR": { en: "2 · Generate AR design", pt: "2 · Gerar design AR", fr: "2 · Générer le design AR", de: "2 · AR-Design erstellen" },
    "Compila el target del tatuaje (para que la cámara lo reconozca) y empaqueta todo en un archivo de diseño.": { en: "Compiles the tattoo target (so the camera recognizes it) and packs everything into a design file.", pt: "Compila o alvo da tatuagem (para a câmera reconhecê-la) e empacota tudo em um arquivo de design.", fr: "Compile la cible du tatouage (pour que la caméra le reconnaisse) et empaquette le tout dans un fichier de design.", de: "Erstellt das Tattoo-Target (damit die Kamera es erkennt) und packt alles in eine Design-Datei." },
    "Generar diseño AR": { en: "Generate AR design", pt: "Gerar design AR", fr: "Générer le design AR", de: "AR-Design erstellen" },
    "Importar .mind": { en: "Import .mind", pt: "Importar .mind", fr: "Importer .mind", de: ".mind importieren" },
    "compilador oficial de MindAR": { en: "official MindAR compiler", pt: "compilador oficial do MindAR", fr: "compilateur officiel de MindAR", de: "offizieller MindAR-Compiler" },
    "3 · Publicar y compartir": { en: "3 · Publish and share", pt: "3 · Publicar e compartilhar", fr: "3 · Publier et partager", de: "3 · Veröffentlichen und teilen" },
    "Publicar y generar QR": { en: "Publish and generate QR", pt: "Publicar e gerar QR", fr: "Publier et générer le QR", de: "Veröffentlichen und QR erstellen" },
    "Descargar .json": { en: "Download .json", pt: "Baixar .json", fr: "Télécharger .json", de: ".json herunterladen" },
    "Probar en el escáner": { en: "Try in the scanner", pt: "Testar no scanner", fr: "Tester dans le scanner", de: "Im Scanner testen" },
    "Ya lo alojaste (avanzado)": { en: "Already hosted it (advanced)", pt: "Já hospedou (avançado)", fr: "Déjà hébergé (avancé)", de: "Bereits gehostet (erweitert)" },
    "Generar QR": { en: "Generate QR", pt: "Gerar QR", fr: "Générer le QR", de: "QR erstellen" },
    // Efectos (effects.js)
    "Pulso de energía": { en: "Energy pulse", pt: "Pulso de energia", fr: "Impulsion d'énergie", de: "Energiepuls" },
    "Destello": { en: "Shimmer", pt: "Brilho", fr: "Éclat", de: "Schimmer" },
    "Ondas líquidas": { en: "Liquid waves", pt: "Ondas líquidas", fr: "Ondes liquides", de: "Flüssige Wellen" },
    "Brasas / partículas": { en: "Embers / particles", pt: "Brasas / partículas", fr: "Braises / particules", de: "Glut / Partikel" },
    "Energía en la tinta (sobre tu tatuaje)": { en: "Energy in the ink (on your tattoo)", pt: "Energia na tinta (na sua tatuagem)", fr: "Énergie dans l'encre (sur votre tatouage)", de: "Energie in der Tinte (auf deinem Tattoo)" }
  };

  var LANGS = ["es", "en", "pt", "fr", "de"], leaves = [];
  function collect() {
    document.querySelectorAll("h1,h2,h3,h4,p,a,button,span,div,li,option,summary,b").forEach(function (el) {
      if (el.children.length === 0) {
        var t = el.textContent.trim();
        if (t && T[t]) { el.dataset.o = t; leaves.push(el); }
      }
    });
  }
  function swap(lang) {
    leaves.forEach(function (el) { var o = el.dataset.o; el.textContent = lang === "es" ? o : (T[o] && T[o][lang]) || o; });
  }
  function applyLang(lang, animate) {
    if (LANGS.indexOf(lang) < 0) lang = "en";
    document.documentElement.setAttribute("lang", lang);
    try { localStorage.setItem("ta:lang", lang); } catch (e) {}
    var code = document.getElementById("langCode"); if (code) code.textContent = lang.toUpperCase();
    document.querySelectorAll("#langMenu button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-lang") === lang); });
    if (animate) { leaves.forEach(function (el) { el.style.transition = "opacity .16s ease"; el.style.opacity = "0"; }); setTimeout(function () { swap(lang); leaves.forEach(function (el) { el.style.opacity = ""; }); }, 170); }
    else swap(lang);
  }

  var MOON = '<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  function applyTheme(t) { document.documentElement.setAttribute("data-theme", t); try { localStorage.setItem("ta:theme", t); } catch (e) {} var i = document.getElementById("themeIcon"); if (i) i.innerHTML = t === "dark" ? MOON : SUN; }

  function init() {
    collect();
    applyLang(window.__taLang || localStorage.getItem("ta:lang") || "es", false);
    applyTheme(document.documentElement.getAttribute("data-theme") || "dark");
    var themeBtn = document.getElementById("themeBtn");
    if (themeBtn) themeBtn.addEventListener("click", function () { applyTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light"); });
    var langBtn = document.getElementById("langBtn"), langMenu = document.getElementById("langMenu");
    if (langBtn && langMenu) {
      langBtn.addEventListener("click", function (e) { e.stopPropagation(); langMenu.classList.toggle("open"); });
      langMenu.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () { applyLang(b.getAttribute("data-lang"), true); langMenu.classList.remove("open"); }); });
      document.addEventListener("click", function (e) { if (!langMenu.contains(e.target) && e.target !== langBtn) langMenu.classList.remove("open"); });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
