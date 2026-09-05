// Build mínimo: comprueba que el Worker importa, expone fetch/scheduled y arranca sin red ni secretos.
const mod = await import("../apps/worker/src/index.js");
if (typeof mod.default?.fetch !== "function") throw new Error("Worker sin handler fetch");
if (typeof mod.default?.scheduled !== "function") throw new Error("Worker sin handler scheduled");
const r = await mod.default.fetch(new Request("https://guard.local/health"), {}, {});
if (r.status !== 200) throw new Error("health no responde 200");
console.log("build-check: ok");
