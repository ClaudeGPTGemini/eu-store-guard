// Frontera unica de autenticacion interna del Worker.
// Cualquier endpoint protegido debe pasar por guardInternalRequest; no se autentica en ningun otro sitio.
// El token solo se lee aqui: index.js no conoce EVALUATE_TOKEN ni la cabecera Authorization.
const SCHEME = "Bearer";
const HEADER = "authorization";

const deny = (error, status) => new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// null = servicio sin configurar (falla cerrado); false = token ausente o incorrecto; true = valido.
export function authorizeInternalRequest(request, env) {
  if (!env?.EVALUATE_TOKEN) return null;
  return (request.headers.get(HEADER) ?? "") === `${SCHEME} ${env.EVALUATE_TOKEN}`;
}

// Devuelve una Response de rechazo (503/401) o null si la peticion puede continuar.
export function guardInternalRequest(request, env) {
  const auth = authorizeInternalRequest(request, env);
  if (auth === null) return deny("service not configured", 503);
  if (!auth) return deny("unauthorized", 401);
  return null;
}
