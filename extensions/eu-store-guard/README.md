# Theme App Extension - EU Store Guard

Publica en la tienda del comerciante, sin tocar el codigo de su tema:

- **App embed block** `guarantee-notice`: aviso armonizado de garantia legal a nivel tienda.
- **App block** `garan-label`: etiqueta GARAN en la pagina de producto, en formato anidado.

## Assets oficiales: importacion automatizada

`assets/` no versiona los archivos de la Comision: se importan en CI con `npm run assets:import`,
que descarga los paquetes oficiales, copia los SVG **en color** sin alterarlos y los renombra a:

- `notice-<locale>-rgb.svg` para cada una de las 24 lenguas oficiales (bg, hr, cs, da, nl, de, el,
  en, et, fi, fr, hu, ga, it, lt, lv, mt, pl, pt, ro, sk, sl, es, sv)
- `garan-rgb.svg` para la etiqueta GARAN (unica para toda la UE)

Fuentes exactas en `scripts/official-sources.json`. El importador escribe `assets-manifest.json`
con el SHA-256 de cada archivo, y `npm run assets:check` falla si alguno no coincide o si falta
alguno de los 24 locales. **No se redibujan, no se recortan, no se recolorean.**

La version en blanco y negro se descarta deliberadamente: solo es valida en tienda fisica.

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
