import { readFileSync, readdirSync } from "node:fs";
import { validateRule } from "./lint.js";
export { activeRules, evaluate, RANK } from "./orchestrator.js";

export function loadRules(dir = new URL("../rules/", import.meta.url)) {
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => validateRule(JSON.parse(readFileSync(new URL(f, dir), "utf8"))));
}
