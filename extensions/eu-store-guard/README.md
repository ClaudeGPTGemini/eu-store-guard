# Theme App Extension - EU Store Guard

Publica en la tienda del comerciante, sin tocar el codigo de su tema:

- **App embed block** `guarantee-notice`: aviso armonizado de garantia legal a nivel tienda.
- **App block** `garan-label`: etiqueta GARAN en la pagina de producto, en formato anidado.

## Assets oficiales versionados

Los 26 SVG oficiales aprobados y assets-manifest.json se conservan en el repositorio: 24 avisos en color, GARAN completo y GARAN anidado. Sus bytes coinciden con los paquetes oficiales descargados.

assets:check verifica lo versionado sin red. assets:drift compara con la fuente oficial sin sobrescribir. assets:import se reserva para importaciones o actualizaciones revisadas.

## Metafields que consume (namespace `eu_store_guard`)

Escritos por la app tras evaluar el core. El tema nunca los inventa.

| Metafield | Uso |
|---|---|
| `garan_status` | Solo se pinta con `CONFIGURED`, `LIVE_PARTIAL` o `LIVE_VERIFIED` (ver CONTRACT.md) |
| `garan_duration_years` | Duracion validada por el core (>2, entero o medio) |
| `garan_brand`, `garan_model` | Marca registrada e identificador de modelo |
| `garan_producer_asset` | Asset facilitado por el productor (caso revendedor) |

## Lo que esta extension NO hace

- No genera avisos ni etiquetas que el productor no haya facilitado.
- No traduce contenido de seguridad ni juridico.
- No afirma cumplimiento: publica informacion y el core verifica que siga visible.
- No recoge datos de clientes finales.

## Integracion continua

El workflow theme-extension ejecuta los tests y assets:check sin descargar assets. El workflow assets-drift compara la fuente oficial semanalmente o bajo ejecucion manual. Los cambios deben revisarse antes de actualizar lo versionado.
