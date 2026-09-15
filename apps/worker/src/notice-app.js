import { appSettings, onlineSession, AppError } from './shopify-session.js';
import { noticeClient } from './shopify-notice-client.js';
import { saveConfiguration } from './notice-configuration.js';
import { activationScript } from './notice-activation.js';
import { recheckNoticeTheme } from './notice-theme-recheck.js';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  ...(status === 401 ? { 'X-Shopify-Retry-Invalid-Session-Request': '1' } : {})
} });

const appScript = `const form=document.querySelector('form'),message=document.querySelector('[role="status"]'),save=document.querySelector('button');
async function call(method,body,path='/app/configuration'){const token=await shopify.idToken();const r=await fetch(path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
function describe(status){return status==='CONFIGURED'?'Configuración guardada. Aún no hemos confirmado que el aviso se muestre. Añade la sección al grupo Header y comprueba la tienda.':status==='NOT_APPLICABLE'?'Aviso desactivado según los datos indicados.':'El aviso permanece desactivado. Falta completar o validar la configuración.';}
form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{const d=await call('POST',{enabled:form.elements.enabled.checked,sellsGoodsToConsumers:form.elements.goods.checked,marketCountry:'ES',locale:'es'});message.textContent=describe(d.status);}catch{message.textContent='No se pudo confirmar el guardado. Recarga la app y vuelve a intentarlo.';}finally{save.disabled=false;}});
call('GET').then(async d=>{form.elements.enabled.checked=d.input?.enabled===true;form.elements.goods.checked=d.input?.sellsGoodsToConsumers===true;const current=d.themeRecheckRequired?await call('POST',{},'/app/recheck-theme'):d;message.textContent=describe(current.status);save.disabled=false;}).catch(error=>{const codes=['SHOPIFY_AUTH_UNREACHABLE','SHOPIFY_AUTH_INVALID_RESPONSE','SHOPIFY_ADMIN_UNREACHABLE','SHOPIFY_ADMIN_INVALID_RESPONSE','INVALID_SESSION','SHOPIFY_AUTH_FAILED','SHOP_OWNER_REQUIRED','SHOPIFY_REQUEST_FAILED','SHOPIFY_QUERY_REJECTED','SHOPIFY_IDENTITY_MISMATCH','METAFIELD_MIGRATION_REQUIRED','APP_REQUEST_FAILED','APP_NOT_CONFIGURED'];message.textContent='No se ha podido conectar con Shopify. Abre esta app desde la administración con la cuenta propietaria.'+(codes.includes(error.message)?' Diagnóstico: '+error.message+'.':'');});`;

async function body(request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new AppError('JSON_REQUIRED', 415);
  if (Number(request.headers.get('content-length')) > 4096 || !request.body) throw new AppError('INVALID_BODY', 413);
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 4096) throw new AppError('INVALID_BODY', 413); chunks.push(part.value); } }
  finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AppError('INVALID_JSON'); }
}

export async function handleNoticeApp(request, env, fetchImpl = (input, init) => fetch(input, init)) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/app')) return null;
  try {
    const settings = appSettings(env);
    if (url.pathname === '/app/app.js' && request.method === 'GET') return new Response(appScript + '\n' + activationScript, { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    if (url.pathname === '/app' && request.method === 'GET') {
      return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="shopify-api-key" content="${settings.clientId}"><title>Configurar aviso de garantía</title><script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script><script src="/app/app.js" defer></script></head><body><main><h1>Aviso de garantía legal en español</h1><p>Configura el aviso armonizado para ventas de bienes a consumidores en España. Esta herramienta no verifica el cumplimiento integral de tu tienda.</p><p>Esta primera versión requiere español como idioma principal de la tienda. GARAN y otros idiomas quedan fuera del alcance.</p><form><p><label><input name="goods" type="checkbox">Vendo bienes a consumidores en España.</label></p><p><label><input name="enabled" type="checkbox">Quiero configurar el aviso en español.</label></p><button disabled>Guardar configuración</button></form><p role="status" aria-live="polite">Conectando con Shopify…</p><p>Después del guardado, abre el editor de Horizon. En el grupo Header, pulsa Añadir sección → Apps → Aviso garantía (Header), y guarda. Comprueba portada, producto, colección, carrito y búsqueda. No uses Aviso sección DEV: es solo una prueba del editor. El embed anterior se retira mediante la migración; no lo actives como respaldo.</p><section aria-labelledby="activation-title"><h2 id="activation-title">¿Se está mostrando el aviso en mi tienda?</h2><p>Esta consulta solo comprueba el tema publicado; no revisa temas borrador ni la presentación del aviso.</p><button type="button" id="check-activation">Comprobar activación</button><p id="activation-result" role="status" aria-live="polite">Aún no hemos confirmado que el aviso se muestre.</p></section><p>La aplicación de la norma comienza el 27 de septiembre de 2026. Una configuración guardada no confirma que el aviso ya se vea en tu tienda.</p></main></body></html>`, { headers: {
        'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; script-src 'self' https://cdn.shopify.com; connect-src 'self' https://admin.shopify.com https://${settings.shop}; img-src 'self' https://cdn.shopify.com; style-src 'self'; frame-ancestors https://admin.shopify.com https://${settings.shop}; base-uri 'none'; form-action 'self'`
      } });
    }
    const recheck = url.pathname === '/app/recheck-theme';
    if (url.pathname !== '/app/configuration' && !recheck) return json({ error: 'NOT_FOUND' }, 404);
    if (recheck && (request.method !== 'POST' || env.NOTICE_THEME_RECHECK_ENABLED !== 'true')) return json({error:'THEME_RECHECK_NOT_ENABLED'},503);
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    if (request.method === 'POST' && request.headers.get('origin') !== url.origin) throw new AppError('INVALID_ORIGIN', 403);
    const input = request.method === 'POST' ? await body(request) : null;
    const session = await onlineSession(request, env, fetchImpl);
    const client = noticeClient(session, fetchImpl);
    if (recheck) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new AppError('INVALID_CONFIGURATION');
      let deployment=null;
      try { deployment=JSON.parse(env.NOTICE_DEPLOYMENT_EVIDENCE ?? 'null'); } catch { /* No review means no permission to preserve publication. */ }
      const result=await recheckNoticeTheme(client,deployment);
      return json({status:result.status,reason:result.config.decision.themeCheck.reason,publicVerification:'pending'});
    }
    if (request.method === 'GET') {
      const snapshot = await client.read(); let input;
      try { input = JSON.parse(snapshot.currentAppInstallation.config?.value ?? 'null')?.input; } catch { throw new AppError('METAFIELD_MIGRATION_REQUIRED', 409); }
      return json({ status: snapshot.shop.notice?.value ?? 'NEEDS_INFORMATION', input, themeRecheckRequired:env.NOTICE_THEME_RECHECK_ENABLED==='true' && input?.enabled===true && !!snapshot.shop.presentation });
    }
    let deployment = null;
    try { deployment = JSON.parse(env.NOTICE_DEPLOYMENT_EVIDENCE ?? 'null'); } catch { /* Missing deployment review must retract, not enable. */ }
    const result = await saveConfiguration(client, input, deployment, new Date(), env.NOTICE_THEME_RECHECK_ENABLED==='true');
    return json({ status: result.status, reasons: result.config.decision.reasons, publicVerification: 'pending' });
  } catch (error) {
    // Do not expose Shopify bodies, identifiers, tokens or exception details.
    return json({ error: error instanceof AppError ? error.message : 'APP_REQUEST_FAILED' }, error instanceof AppError ? error.status : 502);
  }
}
