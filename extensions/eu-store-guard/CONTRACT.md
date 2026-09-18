# Contrato de publicación — candidata v16, pendiente de revisión

El core no cambia: solo CONFIGURED, LIVE_PARTIAL y LIVE_VERIFIED permiten publicar.
Los avisos no hacen fallback de idioma. Esta entrega no implementa el cron de
verificación pública ni certifica estados LIVE.

## Nuevo dato de producto
eu_store_guard.garan_assets_v1 es un metafield JSON nuevo. No cambia el tipo de las
claves previas. SCHEMA, en apps/worker/src/producer-import.js, define su estructura.
El cliente instala la validación Shopify llamada schema y rechaza una definición
existente diferente.

El objeto agrupa las dos variantes del productor:
- state: BLOCKED o READY (estado de importación, independiente del core).
- operation: identificador de operación.
- full y nested: obligatorios cuando READY; cada uno contiene url, width, height,
  sha256 y fileId. La URL procede del CDN Shopify y el ID de GenericFile.
- width y height: enteros 1..100000. Se conservan las dimensiones enteras de la
  raíz (px o sin unidad); si no existen se usan las extensiones del viewBox.
  Para valores fraccionarios se guarda un par proporcional exacto, sin redondeo.
  El tamaño de pantalla se controla explícitamente en CSS.
- sha256: 64 caracteres hexadecimales del archivo servido.

Ambas variantes son obligatorias en este perfil inicial. No se completa una pareja
del productor con recursos oficiales.

## Liquid y migración
Se comprueba presencia del metafield antes de .value. Un objeto vacío, mal tipado,
BLOCKED, incompleto o con dimensiones inválidas bloquea el HTML completo. Liquid
exige tipo json, READY, operación y las dos variantes con URL del CDN, dimensiones,
fileId y huella. Escapa atributos; no descarga ni verifica hashes.

Estas seis claves antiguas bloquean por su presencia, incluso vacías:
garan_producer_asset, garan_producer_nested_asset, garan_producer_asset_width,
garan_producer_asset_height, garan_producer_nested_width, garan_producer_nested_height.

Si no hay nuevo objeto ni restos antiguos, se conserva la ruta oficial sujeta al
core. El escritor de garan_status debe evaluar el rol del comerciante: ausencia
de etiqueta de un revendedor no autoriza CONFIGURED. Este importador no modifica
ni certifica ese estado regulatorio.

PRERREQUISITO: instalar y verificar esta plantilla en DEV antes de importar.
La candidata anterior ignora el bloqueo nuevo.

## Operación
1. Adquirir BLOCKED con compareDigest antes de analizar los bytes.
2. Analizar ambos SVG, subirlos y comparar por SHA-256 con lo servido.
3. Borrar las seis claves antiguas mientras el bloqueo sigue persistido.
4. Escribir la pareja READY usando el digest del bloqueo adquirido.

Borrado y escritura son mutaciones distintas, no una transacción conjunta.
Un fallo no borra el control de publicación. No hay reintento ni desbloqueo
automático. Debe reconciliarse el estado persistido tras una interrupción: Shopify
puede haber escrito READY aunque se pierda su respuesta. No se borran archivos
posiblemente referenciados; se devuelven los IDs conocidos para revisión.

## Perfil SVG
Entrada: bytes UTF-8, nunca URL o dimensiones aportadas. saxes analiza el XML
completo. Se rechazan DTD, instrucciones de procesamiento, namespaces ajenos,
referencias externas, estilos y elementos fuera del perfil estático permitido.
Límite de 2 MB y 128 niveles. No es un sanitizador universal ni acepta cualquier SVG.
Decimales de hasta seis posiciones. Si hay width o height explícitos en la raíz,
se exigen ambos en px o sin unidad y se priorizan sobre viewBox. Se rechazan
dimensiones parciales, porcentajes y unidades físicas, incluso con viewBox.
Sin dimensiones explícitas, viewBox aporta la proporción, no una medida intrínseca
en píxeles. El origen x/y (incluido un desplazamiento) no cambia sus extensiones.
Se conserva la proporción mediante BigInt, sin redondear ni modificar los bytes.
Un archivo fuera del perfil se rechaza.

CSS fija el ancho del GARAN completo en 180px y el anidado en 160px, limitados al
100% del contenedor y con height:auto. Así un par proporcional pequeño no produce
una imagen microscópica, ni uno grande una imagen desbordada. Estos tamaños son
decisiones de presentación DEV, no una certificación de prominencia normativa.

Se usan stagedUploadsCreate y fileCreate como GenericFile, se espera READY y se
obtiene la URL de Shopify. Se vuelve a descargar y comparar su hash antes de
publicar. Esa igualdad se acredita en ese momento; no garantiza inmutabilidad
futura frente a cambios administrativos en Files.

## Evidencia y límites
Pruebas locales con XML y Liquid reales, transporte Shopify simulado, concurrencia,
fallos y proporciones de los 26 SVG versionados. Originales intactos.
Faltan revisión independiente, instalación real, permisos Admin, aceptación del
esquema y SVG en Files, móvil, lector de pantalla y pruebas autenticadas del Worker.
