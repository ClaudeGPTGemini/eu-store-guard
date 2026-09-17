import {invalidatedReview} from './notice-assisted-review.js';
// Invalidation only. An unchanged reviewed theme does not prove storefront visibility.
import { AppError } from './shopify-session.js';

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const date = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v));
const hash = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');

export async function compareThemeRevision(connection, deployment, now) {
  const r=deployment?.themeRevision;
  if (!object(r) || r.reviewed !== true || typeof deployment.themeId !== 'string' ||
      !/^[1-9][0-9]*$/.test(deployment.themeId) || r.themeId !== deployment.themeId ||
      !date(r.updatedAt) || !date(r.reviewedAt) || Date.parse(r.reviewedAt)>now.getTime() ||
      Date.parse(r.updatedAt)>Date.parse(r.reviewedAt) || !/^[a-f0-9]{64}$/.test(r.headerSha256 ?? '')) return 'theme_revision_review_required';
  if (!object(connection) || connection.pageInfo?.hasNextPage !== false || !Array.isArray(connection.nodes) || connection.nodes.length !== 1) return 'published_theme_unknown';
  const theme=connection.nodes[0];
  if (!object(theme) || theme.role !== 'MAIN' || theme.processing !== false || theme.processingFailed !== false || !date(theme.updatedAt)) return 'published_theme_unknown';
  if (theme.id !== 'gid://shopify/OnlineStoreTheme/'+r.themeId) return 'published_theme_changed';
  if (theme.updatedAt !== r.updatedAt) return 'theme_revision_changed';
  const files=theme.files;
  if (!object(files) || files.pageInfo?.hasNextPage !== false || !Array.isArray(files.nodes) || files.nodes.length !== 1) return 'header_file_unknown';
  const file=files.nodes[0];
  if (file?.filename !== 'sections/header-group.json' || typeof file.body?.content !== 'string' ||
      new TextEncoder().encode(file.body.content).length > 1048576) return 'header_file_unknown';
  if (await hash(file.body.content) !== r.headerSha256) return 'header_configuration_changed';
  return 'reviewed_revision_unchanged';
}

export async function recheckNoticeTheme(client, deployment, now=new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new AppError('INVALID_CHECK_TIME');
  const snapshot=await client.read();
  if (typeof deployment === 'function') deployment = deployment(snapshot,now);
  let config,presentation;
  try {
    config=JSON.parse(snapshot.currentAppInstallation.config?.value ?? 'null');
    presentation=JSON.parse(snapshot.shop.presentation?.value ?? 'null');
  } catch { throw new AppError('METAFIELD_MIGRATION_REQUIRED',409); }
  // Do not silently migrate legacy installations through a diagnostic endpoint.
  if (!object(config) || config.version !== 2 || !object(config.input) || !object(config.decision) ||
      !object(presentation) || presentation.version !== 1 || presentation.mechanism !== 'header-section') throw new AppError('METAFIELD_MIGRATION_REQUIRED',409);
  let reason='presentation_binding_changed';
  if (deployment?.shop === snapshot.shop.myshopifyDomain && presentation.themeId === deployment.themeId &&
      typeof deployment.sectionId === 'string' && presentation.sectionId === deployment.sectionId) {
    try { reason=await compareThemeRevision(await client.readPublishedTheme(),deployment,now); }
    catch { reason='theme_check_unavailable'; }
  }
  const previous=snapshot.shop.notice?.value;
  const keepConfigured=reason==='reviewed_revision_unchanged' && config.input.enabled===true &&
    config.decision.status==='CONFIGURED' && previous==='CONFIGURED' && presentation.publicationReady===true;
  const status=keepConfigured?'CONFIGURED':previous==='NOT_APPLICABLE'?'NOT_APPLICABLE':'NEEDS_INFORMATION';
  const decision={...config.decision,status,reasons:keepConfigured?[]:[reason],publicVerification:'pending',
    presentation:{...presentation,publicationReady:keepConfigured,publicVerification:'pending'},
    themeCheck:{checkedAt:now.toISOString(),reason,scope:'admin-theme-revision',publicVerification:'pending'}};
  // The existing writer executes one atomic CAS mutation. Conflicts are not retried.
  return client.write(snapshot,status,{...config,decision,updatedAt:now.toISOString()},reason==='reviewed_revision_unchanged'?undefined:invalidatedReview(snapshot,reason,now));
}
