// EU Store Guard - interaccion minima de los bloques de tema.
// Ambito estrictamente acotado a nuestros contenedores: nunca toca componentes del tema del comerciante.
(function () {
  // Guarda de inicializacion: ambos bloques vinculan este script, y Shopify puede cargarlo dos veces.
  // Sin esto, cada clic ejecutaria el manejador por duplicado y el panel se abriria y cerraria a la vez.
  if (window.__esgInit) return;
  window.__esgInit = true;

  var BOXES = [".esg-notice", ".esg-garan"];
  var SCOPE = BOXES.join(", ");
  // Un selector por contenedor: "a, b [x]" solo aplicaria el descendiente al segundo.
  var OPEN_IN_SCOPE = BOXES.map(function (b) { return b + ' [aria-expanded="true"]'; }).join(", ");
  var TRIGGERS = ".esg-notice__trigger, .esg-garan__nested";

  function toggle(trigger, open) {
    var panel = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!panel) return;
    var next = typeof open === "boolean" ? open : trigger.getAttribute("aria-expanded") !== "true";
    trigger.setAttribute("aria-expanded", String(next));
    panel.hidden = !next;
  }
  var dialogs = new WeakMap();
  function openNotice(trigger) {
    var dialog = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!dialog || typeof dialog.showModal !== "function") return false;
    if (!dialogs.has(dialog)) {
      dialogs.set(dialog, trigger);
      dialog.addEventListener("keydown", function (event) {
        if (event.key !== "Tab") return;
        var items = Array.from(dialog.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')).filter(function (item) { return item.getClientRects().length > 0; });
        if (!items.length) { event.preventDefault(); return; }
        var first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      });
      dialog.addEventListener("close", function () {
        var opener = dialogs.get(dialog);
        opener.setAttribute("aria-expanded", "false");
        if (opener.isConnected) opener.focus();
      });
    }
    dialogs.set(dialog, trigger);
    try { if (!dialog.open) dialog.showModal(); } catch { return false; }
    trigger.setAttribute("aria-expanded", "true");
    dialog.querySelector("h2").focus();
    return true;
  }
  function ours() { return document.querySelectorAll(OPEN_IN_SCOPE); }

  document.addEventListener("click", function (e) {
    var t = e.target.closest(TRIGGERS);
    if (t) {
      if (t.matches(".esg-notice__trigger")) {
        // Preserve native navigation without modal support, on failure and for modified clicks.
        if (e.defaultPrevented || e.button > 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        if (openNotice(t)) e.preventDefault();
      } else { e.preventDefault(); toggle(t); }
      return;
    }
    ours().forEach(function (open) {
      if (open.matches(".esg-notice__trigger")) return;
      var box = open.closest(SCOPE);
      if (box && !box.contains(e.target)) toggle(open, false);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    // Native modal handles Escape, focus containment and background inertness.
    if (document.querySelector(".esg-notice__dialog[open]")) return;
    var abiertos = ours();
    if (!abiertos.length) return;          // sin paneles nuestros abiertos, no interferimos
    abiertos.forEach(function (t) { toggle(t, false); });
    // No se llama a stopPropagation: otros componentes del tema conservan su propio Escape.
  });
})();
