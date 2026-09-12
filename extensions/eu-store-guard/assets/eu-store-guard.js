// EU Store Guard - interaccion minima de los bloques de tema.
// Ambito estrictamente acotado a nuestros contenedores: nunca toca componentes del tema del comerciante.
(function () {
  // Guarda de inicializacion: ambos bloques vinculan este script, y Shopify puede cargarlo dos veces.
  // Sin esto, cada clic ejecutaria el manejador por duplicado y el panel se abriria y cerraria a la vez.
  if (window.__esgInit) return;
  window.__esgInit = true;

  var SCOPE = ".esg-notice, .esg-garan";
  var TRIGGERS = ".esg-notice__trigger, .esg-garan__nested";

  function toggle(trigger, open) {
    var panel = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!panel) return;
    var next = typeof open === "boolean" ? open : trigger.getAttribute("aria-expanded") !== "true";
    trigger.setAttribute("aria-expanded", String(next));
    panel.hidden = !next;
  }
  function ours() { return document.querySelectorAll(SCOPE + " " + '[aria-expanded="true"]'); }

  document.addEventListener("click", function (e) {
    var t = e.target.closest(TRIGGERS);
    if (t) { e.preventDefault(); toggle(t); return; }
    ours().forEach(function (open) {
      var box = open.closest(SCOPE);
      if (box && !box.contains(e.target)) toggle(open, false);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var abiertos = ours();
    if (!abiertos.length) return;          // sin paneles nuestros abiertos, no interferimos
    abiertos.forEach(function (t) { toggle(t, false); });
    // No se llama a stopPropagation: otros componentes del tema conservan su propio Escape.
  });
})();
