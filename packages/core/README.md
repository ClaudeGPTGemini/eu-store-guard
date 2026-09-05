# EU Store Guard — núcleo (fase 0)

Motor de reglas independiente de Shopify. Sin dependencias externas. Node 20+.

- `rules/` — reglas como datos, cinco en V1: aviso de garantía, GARAN, GPSR art. 19, Repair & Update (EmpCo) e idioma mínimo ES para advertencias GPSR. Añadir una obligación = añadir un JSON, sin código.
- `src/status.js` — máquina de estados oficial (nunca COMPLIANT / NON_COMPLIANT).
- `activations/` — MarketActivation: estado regulatorio por país de cada régimen derivado de Directiva (EmpCo: ES = NOT_NOTIFIED a 2026-09-04). Verificado contra EUR-Lex; nunca inferido.
- `src/activation.js` — carga y consulta de MarketActivation. El engine devuelve `technical_status` (intérprete) y `status` (tras activación: tope CONFIGURED si el mercado no está VERIFIED_ACTIVE).
- `src/lint.js` — validación en carga: operadores válidos, sentinels `UNKNOWN`/`unknown` prohibidos como literales de regla, y `unknown_as_false` solo con `depends_on` declarado, exigido previamente y presente en su `requires_if`. Una regla inválida no entra en el motor.
- `src/evaluator.js` — intérprete declarativo de tres valores (all, any, not, eq, gt, present, in, has, fn). Pipeline: derive → gates → required → checks → verification → caps.
- `src/engine.js` — carga reglas, elige versión activa por fecha, evalúa y genera la entrada del Evidence Log. Sin evaluadores por requisito.
- `src/transforms/index.js` — únicas funciones fuera del JSON: resolución locale → asset oficial y validación de duración GARAN.
- `src/completeness.js` — "Product information completeness" (nunca readiness).
- `src/evidenceLog.js` — entrada del registro de configuración y verificación.
- `db/schema.sql` — Postgres (Neon): Store, Market, Product, Requirement, Rule, Evidence, Status, Passport (desactivada).
- `test/` — `node --test`.

Pendiente (requiere cuentas): plantilla oficial Shopify React Router, Theme App Extension,
Checkout UI Extension, cron de verificación en Cloudflare Workers, importación del ZIP oficial de la Comisión (SHA-256 por asset).

## Semántica de tres valores
- Campo ausente, `null`, `"UNKNOWN"` o `"unknown"` = desconocido. Nunca se decide N/A por intuición: desconocido → NEEDS_INFORMATION (o UNKNOWN si la regla lo indica).
- Propagación simétrica: cualquier operando desconocido en `eq`, `gt`, `in`, `has` → unknown. Contenedor conocido con tipo inválido → error de definición de regla.
- `requires_if` con `unknown_as_false` exige `depends_on` (campo padre ya exigido por otro `required`); el linter lo comprueba.
- MarketActivation: `checked_at` es por mercado; un mercado sin comprobación individual devuelve `UNKNOWN` sin fecha. Cada entrada del Evidence Log guarda `technical_status`, estado de activación, fecha, fuente nacional y hash del snapshot.

## Núcleo congelado en v0.2.1
No se añaden obligaciones hasta tener la app instalada en una tienda real.
