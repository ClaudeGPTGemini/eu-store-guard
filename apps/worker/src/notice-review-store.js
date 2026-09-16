// Stored reviews are app data, not merchant assertions or automated observations.
import { AppError } from './shopify-session.js';
import { configurationDecision } from './notice-configuration.js';
import { compareThemeRevision } from './notice-theme-recheck.js';

export function storedNoticeReview(snapshot) {
  let record;
  try { record=JSON.parse(snapshot.currentAppInstallation.review?.value ?? 'null'); } catch { return null; }
  if (!record || record.version !== 1 || record.shop !== snapshot.shop.myshopifyDomain ||
      record.shopId !== snapshot.shop.id || record.installationId !== snapshot.currentAppInstallation.id ||
      record.evidence?.shop !== record.shop || record.source !== 'reviewed-dev-migration') return null;
  return record.evidence;
}

export function noticeReviewSource(env) {
  if (env.NOTICE_REVIEW_SOURCE === 'app-metafield') return storedNoticeReview;
  if (env.NOTICE_REVIEW_SOURCE) return () => null; // Unknown modes must not fall back.
  let legacy=null;
  try { legacy=JSON.parse(env.NOTICE_DEPLOYMENT_EVIDENCE ?? 'null'); } catch { /* No review. */ }
  return legacy;
}

export async function migrateDevReview(client, env, now=new Date()) {
  if (env.APP_ENV !== 'development' || env.NOTICE_REVIEW_MIGRATION_ENABLED !== 'true') throw new AppError('REVIEW_MIGRATION_DISABLED',503);
  const snapshot=await client.read();
  if (snapshot.shop.myshopifyDomain !== env.SHOPIFY_ALLOWED_SHOP) throw new AppError('SHOPIFY_IDENTITY_MISMATCH',502);
  if (snapshot.currentAppInstallation.review) throw new AppError('REVIEW_ALREADY_EXISTS',409);
  let evidence;
  try { evidence=JSON.parse(env.NOTICE_DEPLOYMENT_EVIDENCE ?? 'null'); } catch { throw new AppError('REVIEW_REQUIRED',409); }
  const input={enabled:true,sellsGoodsToConsumers:true,marketCountry:'ES',locale:'es'};
  if (configurationDecision(input,snapshot,evidence).status !== 'CONFIGURED' ||
      await compareThemeRevision(await client.readPublishedTheme(),evidence,now) !== 'reviewed_revision_unchanged') throw new AppError('REVIEW_REQUIRED',409);
  // Only copies an existing operator-reviewed DEV baseline. Never approves a new one.
  // Create-only CAS prevents replacing a review during a concurrent migration.
  return client.writeReview(snapshot,{version:1,source:'reviewed-dev-migration',shop:snapshot.shop.myshopifyDomain,
    shopId:snapshot.shop.id,installationId:snapshot.currentAppInstallation.id,migratedAt:now.toISOString(),evidence});
}
