# v16 — corrección tras auditoría independiente de Claude

Base: v15, commit 4f24394e6c21836ee5aee9ba4bc1784df1b324db.

Hallazgos aceptados: el CSS podía dejar el GARAN completo a 5x4; además, la
extracción ignoraba width/height explícitos de la raíz cuando había viewBox.
Matiz: viewBox aporta coordenadas y proporción, no por sí solo 400x320 píxeles
intrínsecos. ImgWidthAndHeight exige atributos para anticipar la proporción;
no obliga a inferir un tamaño intrínseco que el SVG no declara.

Referencias:
- https://www.w3.org/TR/SVG/coords.html#IntrinsicSizing
- https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/img-width-and-height

## Corrección

1. Se conservan las dimensiones enteras sin reducción por MCD.
2. La pareja explícita de la raíz, en px o sin unidad, tiene prioridad sobre viewBox.
   Valores parciales, porcentajes y unidades físicas se rechazan en este perfil.
3. Los valores fraccionarios se representan con un par exacto; no se introduce
   redondeo ni tolerancia de deformación. El CSS fija el tamaño de presentación.
4. El desplazamiento x/y del viewBox no cambia sus extensiones; queda documentado.
5. GARAN completo: ancho 180px; anidado: 160px; ambos max-width:100%, height:auto.

## Pruebas

Cuatro regresiones automatizadas nuevas cubren escala, prioridad de la raíz,
fracciones, origen desplazado y rechazo de dimensiones ambiguas.
El fixture scripts/producer-sizing-preview.mjs usa el importador y CSS reales:

```sh
node scripts/producer-sizing-preview.mjs
```

Abrir http://127.0.0.1:8766. Comprobado en el navegador integrado: 20/20 casos
correctos, midiendo cajas antes y después de cargar los SVG en contenedores de
320 y 1024px. SVG 400x320 y 5x4: ambos 180x144; raíz 800x200 sobre viewBox cuadrado:
180x45. Incluye anidado, ratio irreducible y origen desplazado.

El margen de 0.1px del fixture solo cubre cuantización del navegador al medir cajas;
no se usa para redondear dimensiones ni aceptar alteraciones de proporción.
Es una prueba de caja de imagen local, no de toda la tienda, del desplegable,
de lector de pantalla o de prominencia. Sigue pendiente esa validación en Shopify.

No cambia el contrato de bloqueo, la autenticación, los SVG oficiales, los secretos
ni el despliegue. PR #3 sigue sin fusionar; candidata Shopify sin activar.
