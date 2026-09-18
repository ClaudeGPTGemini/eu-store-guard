# Entrega de CEO 2 para revisión independiente de Claude

Base remota comprobada: f4251e85dcd63ed67a52bd6faf46734ca1ca74e9,
audit/theme-extension-7de17850, PR #3. Cambios locales, sin activar candidata.

## Qué se entrega

producer-svg.js analiza XML completo con saxes 6.0.0 y obtiene proporciones exactas.
producer-import.js adquiere bloqueo persistido, sube y verifica ambos archivos,
migra las seis claves antiguas y publica la pareja con compareDigest.
shopify-producer-client.js ejecuta GraphQL y subida multipart, comprueba HTTP,
errors y userErrors, limita tiempos y no envía credenciales Admin al almacenamiento.
Liquid bloquea entradas inválidas y consume garan_assets_v1. El contrato completo
está en extensions/eu-store-guard/CONTRACT.md.

El package.json del Worker conserva core y build; añade saxes exacto y LiquidJS
10.29.0 para las pruebas. El lockfile raíz se regenera. No cambia el entrypoint
del Worker, sus secretos ni la configuración de despliegue.

## Verificación desde la raíz

```sh
npm ci
npm test
npm run lint
npm run build
npm run audit:ci
npm install --prefix extensions/eu-store-guard --ignore-scripts --no-save --package-lock=false liquidjs@10.29.0
npm test --prefix extensions/eu-store-guard
npm run assets:check --prefix extensions/eu-store-guard
node --test scripts/package-shopify-dev.test.mjs
```

## Ejecución real pendiente

Primero: revisión de código, instalar la plantilla nueva en DEV y comprobar que
respeta BLOCKED. La plantilla antigua no lo conoce. Después: verificar scopes de
Files/productos y acceso Admin de la app instalada. El App Automation Token de
despliegue no sustituye ese acceso. Confirmar la aceptación del esquema y de SVG
GenericFile en Shopify vivo; los dobles de prueba no lo certifican.

La entrada operativa es scripts/import-producer-dev.mjs. Requiere SHOPIFY_SHOP
igual a eu-store-guard-dev.myshopify.com, SHOPIFY_ADMIN_ACCESS_TOKEN y
ESG_ENABLE_DEV_IMPORT=reviewed-theme-installed. Esta última variable es una barrera
operativa, no una comprobación automática de la plantilla. No se ha ejecutado.

```sh
node scripts/import-producer-dev.mjs gid://shopify/Product/ID full.svg nested.svg
```

## Límites para la auditoría

- Importador ejecutable por operador técnico; no se ha construido OAuth ni un flujo
  continuo desde la app. No hay nueva ruta pública ni ejecución automática.
- No cambia garan_status ni decide aplicabilidad regulatoria.
- Files, borrado y escritura no forman una transacción. El bloqueo y la plantilla
  nueva cubren los estados intermedios.
- Una operación interrumpida exige reconciliación manual por el agente técnico.
  No se desbloquea ni limpia automáticamente. Un fileCreate sin respuesta puede
  dejar un archivo cuyo ID no haya llegado al cliente.
- Igualdad por hash al importar, sin promesa de inmutabilidad futura de Files.
- Perfil SVG restrictivo documentado; no modifica archivos para forzar aceptación.

Producción, fusión del PR y gasto permanecen bloqueados.

## Resultado local

25 pruebas core, 31 Worker, 48 extensión y 3 empaquetado DEV aprobadas.
26 huellas oficiales intactas; lint y auditoría npm sin vulnerabilidades.
build-check aprobado. Wrangler dry-run no pudo completarse en el sandbox Windows:
esbuild recibió Access is denied al recorrer directorios superiores. La compilación
completa debe verificarse en la CI Linux; no se declara aprobada por el resultado local.
