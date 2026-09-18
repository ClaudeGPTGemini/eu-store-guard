import { AppError } from './shopify-session.js';
export function noticeClient(session, fetchImpl = (input, init) => fetch(input, init)) {
  const endpoint = `https://${session.shop}/admin/api/2026-07/graphql.json`;
  async function graph(query, variables = {}) {
    let r;
    try { r = await fetchImpl(endpoint, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': session.token }, body: JSON.stringify({ query, variables }) });
    } catch { throw new AppError('SHOPIFY_ADMIN_UNREACHABLE', 502); }
    if (!r.ok) throw new AppError('SHOPIFY_REQUEST_FAILED', 502);
    let body;
    try { body = await r.json(); } catch { throw new AppError('SHOPIFY_ADMIN_INVALID_RESPONSE', 502); }
    if (body.errors?.length || !body.data) throw new AppError('SHOPIFY_QUERY_REJECTED', 502);
    return body.data;
  }
  async function read() {
    const d = await graph(`query NoticeConfiguration {
      shop { id myshopifyDomain notice:metafield(namespace:"eu_store_guard",key:"notice_status"){value type compareDigest} presentation:metafield(namespace:"eu_store_guard",key:"notice_presentation"){value type compareDigest} }
      currentAppInstallation { id review:metafield(namespace:"eu_store_guard",key:"notice_review"){value type compareDigest} config:metafield(namespace:"eu_store_guard",key:"notice_configuration"){value type compareDigest} }
      shopLocales { locale primary published }
    }`);
    if (d.shop?.myshopifyDomain !== session.shop || !/^gid:\/\/shopify\/Shop\/\d+$/.test(d.shop.id) ||
        !/^gid:\/\/shopify\/AppInstallation\/\d+$/.test(d.currentAppInstallation?.id ?? '') || !Array.isArray(d.shopLocales)) {
      throw new AppError('SHOPIFY_IDENTITY_MISMATCH', 502);
    }
    for (const [field, type] of [[d.shop.notice, 'single_line_text_field'], [d.shop.presentation, 'json'], [d.currentAppInstallation.config, 'json'], [d.currentAppInstallation.review, 'json']]) {
      if (field && (field.type !== type || typeof field.compareDigest !== 'string' || !field.compareDigest)) throw new AppError('METAFIELD_MIGRATION_REQUIRED', 409);
    }
    return d;
  }
  return { read, async writeReview(snapshot, review) {
    const metafields=[{ownerId:snapshot.currentAppInstallation.id,namespace:'eu_store_guard',key:'notice_review',type:'json',value:JSON.stringify(review),compareDigest:snapshot.currentAppInstallation.review?.compareDigest ?? null}];
    const data=await graph('mutation SaveNoticeReview($metafields:[MetafieldsSetInput!]!){metafieldsSet(metafields:$metafields){metafields{namespace key value compareDigest} userErrors{code}}}',{metafields});
    if(data.metafieldsSet?.userErrors?.length)throw new AppError('SAVE_REJECTED_RELOAD',409);
    const written=data.metafieldsSet?.metafields;
    if(!Array.isArray(written)||written.length!==1||written[0].namespace!=='eu_store_guard'||written[0].key!=='notice_review'||written[0].value!==metafields[0].value||!written[0].compareDigest)throw new AppError('SAVE_NOT_CONFIRMED',502);
    return {migrated:true,publicVerification:'pending'};
  }, async readPublishedTheme() {
    // Server-side, read-only query. Requires read_themes; never uses browser observations.
    const data = await graph(`query NoticePublishedTheme {
      themes(first:2,roles:[MAIN]) { pageInfo { hasNextPage } nodes {
        id role updatedAt processing processingFailed
        files(first:2,filenames:["sections/header-group.json"]) {
          pageInfo { hasNextPage } nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } }
        }
      } }
    }`);
    return data.themes;
  }, async write(snapshot, status, config, reviewOverride) {
    // Status, mechanism and configuration migrate atomically with CAS.
    const presentation = config.decision.presentation ?? {version:1,mechanism:'header-section',themeId:null,publicationReady:false,publicVerification:'pending'};
    const metafields = [
      { ownerId: snapshot.shop.id, namespace: 'eu_store_guard', key: 'notice_status', type: 'single_line_text_field', value: status, compareDigest: snapshot.shop.notice?.compareDigest ?? null },
      { ownerId: snapshot.currentAppInstallation.id, namespace: 'eu_store_guard', key: 'notice_configuration', type: 'json', value: JSON.stringify(config), compareDigest: snapshot.currentAppInstallation.config?.compareDigest ?? null },
      { ownerId: snapshot.shop.id, namespace: 'eu_store_guard', key: 'notice_presentation', type: 'json', value: JSON.stringify(presentation), compareDigest: snapshot.shop.presentation?.compareDigest ?? null }
    ];
    // Include the exact reviewed value in the same CAS transaction as publication.
    if (snapshot.currentAppInstallation.review || reviewOverride) metafields.push({ownerId:snapshot.currentAppInstallation.id,namespace:'eu_store_guard',key:'notice_review',type:'json',value:reviewOverride?JSON.stringify(reviewOverride):snapshot.currentAppInstallation.review.value,compareDigest:snapshot.currentAppInstallation.review?.compareDigest ?? null});
    const data = await graph(`mutation SaveNotice($metafields:[MetafieldsSetInput!]!){metafieldsSet(metafields:$metafields){metafields{namespace key value compareDigest} userErrors{code}}}`, { metafields });
    if (data.metafieldsSet?.userErrors?.length) throw new AppError('SAVE_REJECTED_RELOAD', 409);
    const written = data.metafieldsSet?.metafields;
    if (!Array.isArray(written) || written.length !== metafields.length || !metafields.every(f => written.some(w => w.namespace === f.namespace && w.key === f.key && w.value === f.value && w.compareDigest))) throw new AppError('SAVE_NOT_CONFIRMED', 502);
    return { status, config };
  } };
}
