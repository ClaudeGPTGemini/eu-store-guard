# NOTICE-PLACEMENT-2026-09-13 — corrección de interpretación

Fecha: 2026-09-13. Regla EU_LEGAL_GUARANTEE_NOTICE_2026_01, versión 1 → 2.
Excepción al congelado: interpretación corregida y respaldada por fuente, aprobada en la auditoría de esta conversación. No cambia la fecha de aplicación 2026-09-27.

## Antes y después

V1 convertía cabecera, catálogo y checkout en lista cerrada. Las directrices §2.3 (páginas impresas 15–19) dicen que sus ejemplos no son exhaustivos. La Directiva 2024/825, considerando 28, describe un recordatorio general destacado en el sitio web.

- https://commission.europa.eu/document/download/3e4dbee6-8184-4256-923d-c52551c7e9f0_en
- https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32024L0825

V2 distingue ubicaciones soportadas por el producto de ubicaciones legalmente posibles. Incorpora top-bar como presentación propia, no alias de header. Bottom-right, bottom-left e inline quedan en revisión y no renderizan en esta candidata, incluso si queda un estado publicable anterior. No son ubicaciones declaradas ilegales. Un valor desconocido también bloquea.

## Límites de los estados y de la evidencia

La app sigue exigiendo revisión de presentación suministrada por el servidor; el comerciante no puede enviar evidence, reviewed ni verification. CONFIGURED nunca demuestra publicación. No se ha configurado NOTICE_DEPLOYMENT_EVIDENCE en DEV para esta candidata.

El core requiere verification.noticePresentation=true para cualquier LIVE del aviso; sin esa entrada explícita, ni reviewed=true ni una lista de superficies elevan el estado. Esta es una exigencia del contrato de entrada, no un nuevo verificador automático: el evaluador no prueba la veracidad de los datos de quien lo invoca. La app de configuración no envía verification al core y no puede producir LIVE.

El Evidence Log incluye rule_version, SHA-256 del objeto de regla serializado con JSON.stringify, revisión interpretativa, posición, revisión declarada y verificación reportada. V1 se conserva intacta en packages/core/rule-history; se mantiene fuera del cargador de reglas actuales. El test reproduce la decisión de V1 y la contrasta con V2. No se reescriben evaluaciones históricas.

La app guarda el log de la evaluación aceptada dentro de su configuración actual. No es un archivo histórico duradero: el metafield se reemplaza con cada guardado. La conservación append-only de evaluaciones y de sus entradas completas para consultas en 2028 sigue pendiente de infraestructura. No se reclama esa capacidad como resuelta.

## Validación y despliegue

El test cruzado compara todas las opciones reales del schema con la política y ejecuta tanto el core como Liquid. Conserva las pruebas de retracción, idiomas y modal sobre top-bar.

La barra fija todavía requiere comprobar colisiones con cabecera, cookies y menús, lectura a zoom, móviles, foco, legibilidad y acceso al aviso completo. Un nombre de posición, una casilla o CSS no acreditan prominencia. Candidata para auditoría; no desplegada ni declarada verificada. PR #3 sin fusionar, producción bloqueada, 0 €.

