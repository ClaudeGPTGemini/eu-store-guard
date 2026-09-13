import { AppError } from './shopify-session.js';
export function noticeClient(session, fetchImpl = fetch) {
  const endpoint = `https://${session.shop}/admin/api/2026-07/graphql.json`;
  async function graph(query, variables = {}) {
    const r = await fetchImpl(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': session.token }, body: JSON.stringify({ query, variables }) });
    if (!r.ok) throw new AppError('SHOPIFY_REQUEST_FAILED', 502);
    const body = await r.json();
    if (body.errors?.length || !body.data) throw new AppError('SHOPIFY_QUERY_REJECTED', 502);
    return body.data;
  }
  async function read() {
    const d = await graph(`query NoticeConfiguration {
      shop { id myshopifyDomain notice:metafield(namespace:"eu_store_guard",key:"notice_status"){value type compareDigest} }
      currentAppInstallation { id config:metafield(namespace:"eu_store_guard",key:"notice_configuration"){value type compareDigest} }
      shopLocales { locale primary published }
    }`);
    if (d.shop?.myshopifyDomain !== session.shop || !/^gid:\/\/shopify\/Shop\/\d+$/.test(d.shop.id) ||
        !/^gid:\/\/shopify\/AppInstallation\/\d+$/.test(d.currentAppInstallation?.id ?? '') || !Array.isArray(d.shopLocales)) {
      throw new AppError('SHOPIFY_IDENTITY_MISMATCH', 502);
    }
    for (const [field, type] of [[d.shop.notice, 'single_line_text_field'], [d.currentAppInstallation.config, 'json']]) {
      if (field && (field.type !== type || typeof field.compareDigest !== 'string' || !field.compareDigest)) throw new AppError('METAFIELD_MIGRATION_REQUIRED', 409);
    }
    return d;
  }
  return { read, async write(snapshot, status, config) {
    // Both writes succeed together, or neither does. Never overwrite a concurrent update.
    const metafields = [
      { ownerId: snapshot.shop.id, namespace: 'eu_store_guard', key: 'notice_status', type: 'single_line_text_field', value: status, compareDigest: snapshot.shop.notice?.compareDigest ?? null },
      { ownerId: snapshot.currentAppInstallation.id, namespace: 'eu_store_guard', key: 'notice_configuration', type: 'json', value: JSON.stringify(config), compareDigest: snapshot.currentAppInstallation.config?.compareDigest ?? null }
    ];
    const data = await graph(`mutation SaveNotice($metafields:[MetafieldsSetInput!]!){metafieldsSet(metafields:$metafields){metafields{namespace key value compareDigest} userErrors{code}}}`, { metafields });
    if (data.metafieldsSet?.userErrors?.length) throw new AppError('SAVE_REJECTED_RELOAD', 409);
    const written = data.metafieldsSet?.metafields;
    if (!Array.isArray(written) || written.length !== 2 || !metafields.every(f => written.some(w => w.namespace === f.namespace && w.key === f.key && w.value === f.value && w.compareDigest))) throw new AppError('SAVE_NOT_CONFIRMED', 502);
    return { status, config };
  } };
}
