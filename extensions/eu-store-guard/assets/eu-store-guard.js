// EU Store Guard - interaccion minima de los bloques de tema.
// Un solo listener delegado: sin dependencias, sin peticiones de red, sin datos de cliente.
(function () {
  function toggle(trigger) {
    var panel = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!panel) return;
    var open = trigger.getAttribute("aria-expanded") === "true";
    trigger.setAttribute("aria-expanded", String(!open));
    panel.hidden = open;
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest(".esg-notice__trigger, .esg-garan__nested");
    if (t) { e.preventDefault(); toggle(t); return; }
    document.querySelectorAll('.esg-notice__trigger[aria-expanded="true"], .esg-garan__nested[aria-expanded="true"]').forEach(function (openTrigger) {
      if (!openTrigger.parentElement.contains(e.target)) toggle(openTrigger);
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    document.querySelectorAll('[aria-expanded="true"]').forEach(toggle);
  });
})();
