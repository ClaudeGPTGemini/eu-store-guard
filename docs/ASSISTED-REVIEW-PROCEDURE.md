# Procedimiento de revisión asistida y custodia — v1

Estado: procedimiento para la candidata 9a2cb81. No acredita custodia configurada, revisión realizada, clave creada ni autorización de producción. El Worker continúa limitado a DEV.

## Responsabilidad y custodia

David es el responsable de designar por nombre al custodio y a los operadores autorizados. Ninguna identidad queda autorizada por rellenar reviewerId. Antes de habilitar firmas debe existir un registro privado con custodio, operadores, equipo autorizado, ubicación de almacenamiento, fecha y huella SHA-256 de la clave pública. Hoy esos nombramientos y la ubicación real están pendientes.

La clave privada se conserva fuera del repositorio, chats, navegador, Shopify, Worker y registros de CI. Ubicación prevista: equipo del operador con disco cifrado y directorio dedicado, acceso limitado a la cuenta operadora. La copia de recuperación, si existe, se guarda cifrada y con acceso separado. No se activa el servicio hasta verificar permisos efectivos y recuperación. En Windows, mode=0600 del script no establece por sí solo una ACL: hay que comprobar los permisos del directorio. El firmador actual necesita una clave legible durante la operación; no proporciona almacén de claves ni gestión de contraseñas.

El Worker recibe solo la clave pública. Esto evita que su lectura revele la privada; NO impide que un atacante con control del código o del despliegue omita la verificación, cambie la clave pública o altere datos usando los permisos de la app. Los accesos a GitHub, Cloudflare y al proceso de despliegue forman parte del control de autoridad.

## Expediente obligatorio antes de firmar

Crear un expediente privado usando docs/reviews/REVIEW-RECORD.template.json. No subir expedientes reales, capturas de clientes, credenciales ni direcciones privadas al repositorio público. Registrar reviewId único, operador identificado, fecha UTC, tienda, Shop ID, instalación, tema, revisión de cabecera, sección y versión de extensión/código. Obtener identificadores y hashes por la lectura autenticada; no copiarlos de otra tienda.

Inspeccionar portada, producto, colección, carrito y búsqueda. Para cada ruta anotar URL sin tokens, fecha, mecanismo de acceso (editor, vista previa, escaparate autenticado o anónimo), resultado, captura y SHA-256 del archivo. Si una ruta no existe, registrar el motivo y resolver el alcance: no marcarla como aprobada. Comprobar que el enlace está antes del contenido principal, no tapa menú/búsqueda/carrito y no existe duplicación ni bloque de inspección activo.

Registrar por separado: apertura del diálogo, cierre visible, Escape, foco inicial y retorno, navegación por teclado, transcripción española, enlace al original y Your Europe, convivencia con el tema y anchura de pantalla. Una captura no demuestra interacción. Una inspección del árbol accesible no demuestra lectura con VoiceOver/TalkBack. Teléfono físico y lector real deben constar como realizados con dispositivo/resultados o pendientes; nunca inferidos.

La revisión previa puede aprobar únicamente colocación asistida y permitir un posterior guardado. Si se usó el editor para esa fase, el expediente lo dice. Tras aplicar y guardar, comprobar el escaparate canónico y añadir un registro posterior separado: no reescribir el expediente ya firmado para aparentar que la comprobación existía antes. No otorgar LIVE_VERIFIED ni afirmar cumplimiento integral.

No firmar con pruebas ausentes, contradictorias, de otro tema, artefactos modificados o defectos que impidan el alcance aprobado. Ante una limitación fuera de alcance, dejarla explícita. No aprobar por una casilla del comerciante ni por presión de la cola.

## Vinculación y firma

Conservar los bytes del expediente final y las capturas. Calcular SHA-256 del expediente e incluirlo en evidence.reviewDossierSha256 del registro de aprobación antes de firmar; evidence.reviewRecord debe coincidir con reviewId. El esquema actual permite esa referencia dentro de evidence y la firma cubre esos bytes. Es un requisito PROCEDIMENTAL: el firmador actual y el Worker no comprueban la existencia, completitud ni fidelidad del expediente. No presentar este procedimiento como una validación automática.

Releer el tema publicado inmediatamente antes de firmar: identificador, updatedAt y hash deben coincidir con lo revisado. Usar previousDigest actual (null únicamente para primera aprobación), nueva reviewId y vencimiento explícito de como máximo 30 días. Ese máximo es política técnica de la candidata, no plazo legal ni promesa de vigilancia continua.

Firmar mediante scripts/sign-notice-review.mjs. Verificar que el artefacto se generó sin sobrescribir otro. Archivar expediente, capturas, registro sin firmar, sobre firmado, clave pública/huella y recibo de aplicación. El propietario aplica el archivo por la app autenticada; nunca recibe la clave privada. La aceptación mantiene NEEDS_INFORMATION: requiere guardado explícito y comprobación posterior.

## Invalidación, renovación y atención

Al detectar un cambio, un vencimiento o una comprobación no fiable, el registro asistido queda review_required y el aviso deja de ser publicable. La detección ocurre al abrir/guardar; no hay cron ni retirada exacta al segundo del vencimiento. Informar al comerciante de esa limitación antes de contratar.

Abrir una incidencia de renovación en el registro privado de operaciones, con causa, fecha y responsable. El software actual NO crea una cola atendida, avisos ni plazos de respuesta: deben organizarse antes de admitir clientes. Restaurar el tema no basta. Repetir comprobaciones, generar expediente y firma nuevos con el digest vigente. Conservar la aprobación anterior y su motivo de invalidación.

## Incidente o cambio de clave

Suspender nuevas firmas y nuevas aceptaciones si hay sospecha de acceso indebido. Investigar también despliegues y escrituras en Shopify. Cambiar la clave pública no revoca automáticamente revisiones ya almacenadas: es necesario identificar, retirar y comprobar los estados afectados. No afirmar revocación global mientras no se verifique cada instalación. Mantener claves públicas antiguas para comprobar expedientes históricos; no conservar privadas comprometidas como medio de firma.

## Puerta de puesta en servicio

Pendientes: custodio y operadores designados; almacenamiento/ACL/recuperación verificados; registro privado de expedientes e incidencias; clave pública configurada por el canal autorizado; prueba completa en DEV de firma, aplicación, cambio, invalidación y renovación; prueba física/accesible y alcance comercial acordado. Este documento no autoriza gastos, producción ni fusionar PR #3.
