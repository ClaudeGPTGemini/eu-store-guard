# v19 — candidata local de configuración del aviso

Esta entrega añade rutas ejecutables al Worker, pero NO está desplegada ni conectada
a credenciales reales. No certifica la instalación autónoma en Shopify.

## Flujo implementado

`GET /app` sirve el formulario español con App Bridge. El navegador obtiene un ID
token y lo envía por Authorization a `/app/configuration`. El backend comprueba
HS256 con Web Crypto y las claims de audiencia, emisor, destino, tiempos y usuario.
El destino permitido en esta candidata es exclusivamente la tienda DEV existente.

El backend intercambia el ID token por un token ONLINE de Shopify y exige que sea
de la cuenta propietaria. No hay cookies de autenticación propias, tokens en URLs,
persistencia de tokens, almacenamiento de emails ni endpoint público que devuelva
credenciales. No admite todavía cuentas de personal. No implementa trabajo fuera
de sesión ni verificación programada; el cron existente continúa vacío.

Consulta tienda, instalación actual, idioma principal y metacampos. Los IDs de los
propietarios salen de Shopify. Escribe `shop.eu_store_guard.notice_status` y
`appInstallation.eu_store_guard.notice_configuration` en un solo `metafieldsSet`,
con `compareDigest` para ambos. Los errores GraphQL, userErrors y escrituras no
confirmadas son fallos explícitos. No reintenta sobre un conflicto.

`enabled` en el formulario solo es una preferencia dentro de notice_configuration.
NO escribe el metacampo de app `eu_store_guard.enabled`, que hace seleccionable GARAN.
No solicita permisos de productos ni Files, ni cambia los scopes actuales.

## Gates antes de CONFIGURED

- Declaración explícita de venta B2C de bienes en España.
- Alcance es/ES y español publicado como idioma principal, consultado en Shopify.
- Evidencia de despliegue revisada del lado servidor, independiente del formulario.
- Evaluación del core para la regla del aviso: CONFIGURED y lista de motivos vacía.

El core puede devolver CONFIGURED con motivos de fallo de configuración. Esta capa
no publica ese resultado: lo transforma en NEEDS_INFORMATION. No cambia el core.
CONFIGURED describe preparación, incluida preparación anterior al 27-09-2026;
no significa obligación ya aplicable, activación del tema ni verificación pública.
No se genera LIVE_PARTIAL ni LIVE_VERIFIED.

Cambiar una configuración válida a datos de negocio incompletos/no soportados
escribe un estado no publicable. Un request de formato inválido se rechaza sin
mutación. Una caída de red NO permite prometer retracción: si no se puede escribir,
el estado previo puede permanecer. Se informa fallo y debe reconciliarse al volver.

## Activación pendiente, sin tocar secretos existentes

La candidata devuelve 503 salvo que concurran APP_ENV=development,
SHOPIFY_APP_ENABLED=true, SHOPIFY_CLIENT_ID válido, SHOPIFY_CLIENT_SECRET y
SHOPIFY_ALLOWED_SHOP=eu-store-guard-dev.myshopify.com.

El secreto de cliente debe custodiarse en Cloudflare, no en este ZIP ni en chat.
No se ha auditado su existencia en Cloudflare durante esta entrega; el entorno
local no contiene variables Shopify. El token de automatización de CLI no sirve.
No se ha escrito, rotado ni extraído ningún secreto.

NOTICE_DEPLOYMENT_EVIDENCE es un JSON de configuración del servidor con reviewed,
assetHash, officialHashes, assetLocale, isRgb, entryPoint,
interactionsToFullNotice y yourEuropeLinkPresent. No está configurado. No se debe
rellenar con hechos supuestos: el widget flotante actual aún necesita una decisión
explícita sobre su correspondencia con header/catalog/checkout del core. Si falta
esta revisión, una petición válida guarda NEEDS_INFORMATION, no publica.

La app sigue apuntando a la página genérica de Shopify: después de auditar código,
aprobar configuración y disponer del secreto, habrá que apuntar la app DEV a /app,
validar App Bridge/CSP y comprobar los permisos efectivos de la mutación en tienda.
No se puede confirmar ese permiso basándose solo en tests de respuestas simuladas.

## Evidencia y límites de pruebas

13 pruebas nuevas: firma/claims negativas, ausencia de credenciales, rechazo antes
de llamadas externas, usuario no propietario, gates, inyección de estado/owner,
mutación CAS, retracción, conflicto, origen/cuerpo, errores e identidad de Shopify,
y shell sin secretos. Ejecutan el handler y el código real con respuestas Shopify
simuladas. No equivalen a autenticación, instalación ni escritura real en Shopify.
La evidencia de despliegue usada en las pruebas es un fixture, no una aprobación.
El formulario todavía no ha sido probado dentro del iframe real de Shopify.

## Referencias revisadas

- https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange
- https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldsSet

PR #3 sin fusionar. v18 continúa activa en DEV. Producción y gasto bloqueados.
