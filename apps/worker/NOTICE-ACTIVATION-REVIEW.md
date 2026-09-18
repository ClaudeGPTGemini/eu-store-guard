# v20: observación de activación, pendiente de prueba en Shopify

Añade una consulta manual y de solo lectura mediante `shopify.app.extensions()`.
Se identifica la extensión `eu-store-guard`, bloque `guarantee-notice`, destino
`body` y una colocación `theme` con ID de tema válido. Respuestas ausentes,
ambiguas, contradictorias o fallidas no se presentan como activación confirmada.
Cada consulta retira la observación anterior mientras espera; expira a los 10 s.

La API informa únicamente del tema publicado. No verifica el borrador Horizon,
el HTML servido, las condiciones de Liquid, idioma, visibilidad, legibilidad,
interacciones ni accesibilidad. No escribe metafields, no eleva estados del core,
no se envía como evidencia al servidor y mantiene `publicVerification: pending`.
Una observación es puntual: el comerciante puede volver a consultar; no es un
monitor continuo. No añade permisos ni instala o publica temas.

Referencia oficial consultada el 13 de septiembre de 2026:
https://shopify.dev/docs/api/app-home/latest/apis/authentication-and-data/app-api

Cinco pruebas nuevas cubren selección del bloque, entradas corruptas,
ejecución del mismo script servido, fallo posterior a éxito, API ausente y
timeout. Usan respuestas simuladas: no sustituyen ejecutar App Bridge en la app
instalada. Conteo: core 25, Worker 53, extensión 56, empaquetado 3 = 137.

Pendiente: conectar la credencial de la app de manera segura y probar el flujo
real de v19/v20 en DEV; verificar la superficie pública por separado; teléfono
físico y lector de pantalla real. v18 sigue siendo la versión desplegada.
PR #3 sin fusionar, producción y gasto bloqueados.
