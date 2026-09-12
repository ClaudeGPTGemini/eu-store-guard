# Contrato Worker -> Shopify -> Liquid

Define quien escribe cada dato y que puede pintar el tema. El tema **nunca** decide aplicabilidad
regulatoria: solo refleja lo que el core ya evaluo.

## 1. Worker -> Shopify (metafields)

La app evalua el core y escribe metafields en el namespace `eu_store_guard`. Estados permitidos,
identicos a `packages/core/src/status.js`:

    NOT_APPLICABLE | NEEDS_INFORMATION | CONFIGURED | LIVE_PARTIAL | LIVE_VERIFIED | UNKNOWN

Mas el valor derivado `LANGUAGE_REVIEW_REQUIRED`, que solo produce la resolucion de locale.

### Nivel tienda (`shop.metafields.eu_store_guard`)
| Clave | Tipo | Origen |
|---|---|---|
| `notice_status` | estado | evaluacion de EU_LEGAL_GUARANTEE_NOTICE_2026_01 |

### Nivel producto (`product.metafields.eu_store_guard`)
| Clave | Tipo | Origen |
|---|---|---|
| `garan_status` | estado | evaluacion de EU_GARAN_2026_01 |
| `garan_duration_years` | number | validado: > 2, entero o medio anio |
| `garan_brand` | string | marca registrada, facilitada por el productor |
| `garan_model` | string | identificador de modelo, facilitado por el productor |
| `garan_producer_asset` | url | asset del productor (caso revendedor) |
| `garan_producer_nested_asset` | url | asset anidado facilitado por el productor, con prioridad sobre el oficial |

## 2. Shopify -> Liquid (que se pinta)

Regla unica, aplicada en los dos bloques:

| Estado | Se pinta? | Motivo |
|---|---|---|
| `LIVE_VERIFIED` | SI | datos completos y verificados en la superficie publica |
| `LIVE_PARTIAL` | SI | datos completos; falta verificar alguna superficie |
| `CONFIGURED` | SI | datos completos; aun sin verificacion publica |
| `NEEDS_INFORMATION` | NO | faltan datos del productor: publicar seria inventar |
| `NOT_APPLICABLE` | NO | la obligacion no aplica a este producto o mercado |
| `UNKNOWN` | NO | el core no pudo determinarlo: no se decide por intuicion |
| `LANGUAGE_REVIEW_REQUIRED` | NO | locale fuera de las 24 oficiales; prohibido fallback a ingles |

Ningun otro valor pinta. Un estado desconocido o vacio se trata como no pintable.

## 3. Invariantes

1. El tema no compone assets: solo referencia los oficiales por nombre.
2. El tema no traduce: usa el asset del locale o no pinta.
3. Ningun estado nuevo puede introducirse sin existir antes en el core.
4. `NEEDS_INFORMATION` nunca pinta, aunque haya duracion: seria publicar un dato incompleto.

## 4. Retraccion de contenido

El tema **no cachea** estado. Cada render lee el metafield vigente, de modo que una degradacion a
`NEEDS_INFORMATION`, `NOT_APPLICABLE` o `UNKNOWN` deja de pintar en el siguiente render, sin
intervencion ni purga manual. No existe ruta por la que el bloque muestre un estado anterior.

Consecuencia buscada: **el contenido obsoleto no sobrevive al cambio de estado**. Es preferible no
mostrar nada a mostrar informacion regulatoria que el core ya no respalda.

## 5. Por que CONFIGURED publica

`LIVE_VERIFIED` significa que Guard **ha visto** el aviso en la superficie publica. Exigirlo para
publicar seria circular: nunca podria verificarse algo que no se ha publicado todavia.

La secuencia real es: datos completos (`CONFIGURED`) -> se publica -> el cron verifica la superficie
publica -> `LIVE_PARTIAL` o `LIVE_VERIFIED`. Por eso `CONFIGURED` es el umbral de publicacion y los
estados LIVE son consecuencia, no requisito.
