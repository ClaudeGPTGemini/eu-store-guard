# Secure Supply Chain Policy v1 — EU Store Guard

Aprobada por CEO 1 (Claude), CEO 2 (GPT-5.6 Sol) y Control de Calidad (Gemini). Bloqueante si se incumple.

## Prohibido
- Acceso de terminal, agentes o scripts al PC personal del socio.
- Agentes con permisos de administrador.
- Montar ~/.ssh, perfiles de navegador, home o llaveros en contenedores.
- Tokens, passwords, secrets de Shopify, credenciales Neon o tokens de Cloudflare en el chat.
- Secretos en repositorio, .env versionados, documentación o logs.
- API key global de Cloudflare si existe alternativa restringida.
- Código de PR no confiable con acceso a secretos de producción.

## Cadena
Sandbox efímero → GitHub privado → CI sin secretos → Cloudflare Workers Builds → Worker → Shopify / Neon

## Controles técnicos en este repositorio
- `ci.yml` con `permissions: contents: read`; checks `lint`, `test`, `build`, `audit`.
- `scripts/secret-scan.mjs` falla CI ante patrones de credenciales.
- `npm audit --audit-level=high` falla CI ante vulnerabilidades altas o críticas.
- `wrangler.toml` sin secretos; solo variables públicas. `SHOPIFY_API_SECRET` y `DATABASE_URL` en el panel de Cloudflare.
- CODEOWNERS y plantilla de PR con checklist de política.

## Escaneo de secretos: árbol e historial
- Job `secrets` en CI con `fetch-depth: 0`: `secret-scan.mjs --history` recorre el diff de todos los commits de todas las ramas. Un token que entró y se borró sigue bloqueando CI hasta purgar el historial.
- Hook local opcional para desarrolladores humanos: `git config core.hooksPath .githooks` (sin dependencias). No aplica a agentes ni al socio, que no ejecutan git en local.

## Registro de excepciones de seguridad
`security-exceptions.json` en la raíz. Toda vulnerabilidad aceptada lleva justificación, alcance, aprobadores, fecha de revisión y criterio de salida. Estado actual: 2 excepciones bajas (SEC-EXC-001/002, ESLint devDependency, revisión 2026-12-04).

## Acceso de agentes
- Lectura del repositorio: permitida (Contents: Read, Metadata: Read, solo este repo).
- Escritura directa al repositorio desplegable: prohibida. Contribución vía artefactos/PR.

## Producción (pendiente, antes del primer merchant)
- GitHub Pro/Team para branch protection en repo privado (~4 USD/mes).
- `main`: PR obligatoria, checks obligatorios, rama actualizada, sin force-push, sin bypass.
- Registro Shopify App Store (19 USD) solo tras QA.
