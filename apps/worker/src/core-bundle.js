// El Worker no tiene sistema de archivos: recibe las reglas ya cargadas como objetos.
// El motor NO se reimplementa aqui: se importa el mismo orquestador que usa Node.
import { validateRule } from "@eu-store-guard/core/lint";
export { activeRules, evaluate } from "@eu-store-guard/core/orchestrator";
export function loadRulesFromObjects(objs) { return objs.map(validateRule); }
