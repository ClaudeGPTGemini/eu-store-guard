// Session-bound access only. No tokens are persisted or returned to the browser.
export class AppError extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}

export function appSettings(env) {
  if (env.APP_ENV !== 'development' || env.SHOPIFY_APP_ENABLED !== 'true' ||
      !/^[a-f0-9]{32}$/.test(env.SHOPIFY_CLIENT_ID ?? '') ||
      typeof env.SHOPIFY_CLIENT_SECRET !== 'string' || env.SHOPIFY_CLIENT_SECRET.length < 32 ||
      env.SHOPIFY_ALLOWED_SHOP !== 'eu-store-guard-dev.myshopify.com') {
    throw new AppError('APP_NOT_CONFIGURED', 503);
  }
  return { clientId: env.SHOPIFY_CLIENT_ID, secret: env.SHOPIFY_CLIENT_SECRET, shop: env.SHOPIFY_ALLOWED_SHOP };
}

function decode(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new AppError('INVALID_SESSION', 401);
  return Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

export async function verifySession(token, settings, now = Math.floor(Date.now() / 1000)) {
  try {
    if (typeof token !== 'string' || token.length > 8192) throw Error();
    const parts = token.split('.');
    if (parts.length !== 3) throw Error();
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if (header.alg !== 'HS256' || header.crit !== undefined || header.b64 !== undefined) throw Error();
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(settings.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('HMAC', key, decode(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]))) throw Error();
    const c = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    if (c.aud !== settings.clientId || c.dest !== `https://${settings.shop}` || c.iss !== `https://${settings.shop}/admin` ||
        !Number.isInteger(c.exp) || !Number.isInteger(c.nbf) || !Number.isInteger(c.iat) ||
        c.exp <= now || c.nbf > now || c.iat > now || c.exp <= c.iat || c.exp - c.iat > 120 || now - c.iat > 120 ||
        !/^\d+$/.test(c.sub ?? '') || typeof c.sub !== 'string') throw Error();
    return { shop: settings.shop, userId: c.sub };
  } catch { throw new AppError('INVALID_SESSION', 401); }
}

export async function onlineSession(request, env, fetchImpl = (input, init) => fetch(input, init)) {
  const settings = appSettings(env);
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) throw new AppError('INVALID_SESSION', 401);
  const token = auth.slice(7);
  const identity = await verifySession(token, settings);
  let response;
  try { response = await fetchImpl(`https://${identity.shop}/admin/oauth/access_token`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: settings.clientId, client_secret: settings.secret,
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange', subject_token: token,
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:online-access-token' })
  }); } catch { throw new AppError('SHOPIFY_AUTH_UNREACHABLE', 502); }
  if (!response.ok) throw new AppError('SHOPIFY_AUTH_FAILED', 502);
  let data;
  try { data = await response.json(); } catch { throw new AppError('SHOPIFY_AUTH_INVALID_RESPONSE', 502); }
  if (typeof data.access_token !== 'string' || !data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0 ||
      String(data.associated_user?.id) !== identity.userId || data.associated_user?.account_owner !== true) {
    throw new AppError('SHOP_OWNER_REQUIRED', 403);
  }
  return { ...identity, token: data.access_token };
}
