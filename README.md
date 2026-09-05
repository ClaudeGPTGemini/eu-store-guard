# EU Store Guard

Software para tiendas Shopify que detecta información europea de producto que falta, la publica y verifica que siga visible.
No es asesoramiento jurídico ni una evaluación de cumplimiento.

## Estructura
- `packages/core` — motor de reglas declarativo (v0.2.1, CONGELADO). 5 reglas, MarketActivation, Evidence Log. 25 tests.
- `apps/worker` — Cloudflare Worker (DEV). Expone `/health`, `/rules`, `POST /evaluate`. OAuth, Shopify y Theme App Extension: siguiente hito.
- `scripts/` — `secret-scan.mjs` (bloquea CI si detecta secretos), `bundle-rules.mjs` (copia reglas al Worker), `build-check.mjs`.
- `.github/workflows/ci.yml` — lint, test, build, audit. Sin secretos. Nombres de check fijos para la protección de `main`.

## Comandos
    npm ci
    npm run lint
    npm test
    npm run build
    npm run audit:ci

## Política de seguridad (resumen; ver docs/SECURITY.md)
- Ningún agente accede al ordenador personal del socio. Todo corre en sandbox, GitHub Actions o Cloudflare Workers Builds.
- Secretos solo en gestores de secretos de cada plataforma (Cloudflare, Shopify Partners, GitHub Secrets). Nunca en código, chat, .env versionado, docs o logs.
- Repositorio privado. Agentes con acceso de solo lectura. Escritura a través de PR con CI verde y revisión humana.
- DEV y PROD separados en app, tienda, Worker, base de datos y credenciales.
- `main` protegida antes de producción (requiere GitHub Pro/Team en repo privado).

## Entornos
| Recurso | DEV | PROD |
|---|---|---|
| Shopify App | separada | separada |
| Tienda | development store | merchants |
| Worker | eu-store-guard-dev | eu-store-guard |
| Neon | dev | prod |
| Secrets | solo dev | solo prod |
| Rama | develop | main protegida |

## Estado
- v0.3.0: repositorio inicializado, CI operativo, Worker DEV con el núcleo integrado.
- Siguiente hito: plantilla oficial Shopify React Router, development store, OAuth, Products, Markets, metafields, Theme App Extension, install/uninstall/reinstall.
