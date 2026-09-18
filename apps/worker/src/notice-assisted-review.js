// Operator signatures authorize a bounded presentation review, never a LIVE state.
import {AppError} from './shopify-session.js';
import {compareThemeRevision} from './notice-theme-recheck.js';

const object=v=>v!==null && typeof v==='object' && !Array.isArray(v);
const fail=()=>{throw new AppError('INVALID_REVIEW_APPROVAL',409);};
const instant=v=>typeof v==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString()===v;
const id=v=>typeof v==='string' && /^[a-zA-Z0-9_-]{8,100}$/.test(v);
const decode=v=>{
  if(typeof v!=='string'||!v.length||v.length>6000||!/^[A-Za-z0-9_-]+$/.test(v))return fail();
  return Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
};
export function approvalEvidence(record,now=new Date()) {
  if(!object(record)||record.version!==2||record.source!=='assisted-review'||record.status!=='approved'||
      !id(record.reviewId)||!id(record.reviewerId)||!instant(record.reviewedAt)||!instant(record.expiresAt)||
      Date.parse(record.reviewedAt)>now.getTime()||Date.parse(record.expiresAt)<=now.getTime()||
      Date.parse(record.expiresAt)-Date.parse(record.reviewedAt)>30*86400000||
      record.evidence?.reviewScope!=='assisted-placement'||record.evidence.reviewRecord!==record.reviewId) return null;
  return record.evidence;
}
export function invalidatedReview(snapshot,reason,now) {
  let record;
  try {record=JSON.parse(snapshot.currentAppInstallation.review?.value ?? 'null');} catch {return undefined;}
  if(record?.version!==2||record.source!=='assisted-review'||record.status!=='approved')return undefined;
  return {...record,status:'review_required',invalidatedAt:now.toISOString(),invalidationReason:reason};
}

export async function acceptAssistedReview(client,envelope,env,now=new Date()) {
  if(env.NOTICE_ASSISTED_REVIEW_ENABLED!=='true'||env.NOTICE_REVIEW_SOURCE!=='app-metafield')throw new AppError('ASSISTED_REVIEW_DISABLED',503);
  if(!object(envelope)||Object.keys(envelope).sort().join(',')!=='payload,signature')fail();
  const bytes=decode(envelope.payload),signature=decode(envelope.signature);
  let key;
  try {key=await crypto.subtle.importKey('raw',decode(env.NOTICE_REVIEW_PUBLIC_KEY),{name:'Ed25519'},false,['verify']);}
  catch {throw new AppError('REVIEW_KEY_NOT_CONFIGURED',503);}
  if(signature.length!==64||!await crypto.subtle.verify('Ed25519',key,signature,bytes))fail();
  let record;
  try {record=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));} catch {fail();}
  const fields=['version','source','status','reviewId','reviewerId','reviewedAt','expiresAt','shop','shopId','installationId','previousDigest','evidence'];
  if(!object(record)||Object.keys(record).sort().join(',')!==fields.sort().join(',')||
      !(record.previousDigest===null||typeof record.previousDigest==='string'&&record.previousDigest.length>0)||
      !approvalEvidence(record,now))fail();
  const snapshot=await client.read();
  const e=record.evidence;
  if(record.shop!==snapshot.shop.myshopifyDomain||record.shopId!==snapshot.shop.id||record.installationId!==snapshot.currentAppInstallation.id||
      e.shop!==record.shop||record.previousDigest!==(snapshot.currentAppInstallation.review?.compareDigest ?? null)||
      e.reviewed!==true||e.entryPoint!=='header-section'||typeof e.sectionId!=='string'||!/^sections--[1-9][0-9]*__[a-zA-Z0-9_-]+$/.test(e.sectionId)||
      e.themeRevision?.reviewedAt!==record.reviewedAt)fail();
  // A renewal is a distinct operator act. An old signature cannot be replayed.
  let previous=null;
  try {previous=JSON.parse(snapshot.currentAppInstallation.review?.value ?? 'null');} catch {fail();}
  if(previous?.reviewId===record.reviewId)fail();
  if(await compareThemeRevision(await client.readPublishedTheme(),e,now)!=='reviewed_revision_unchanged')throw new AppError('REVIEW_THEME_CHANGED',409);
  let stored;
  try {stored=JSON.parse(snapshot.currentAppInstallation.config?.value ?? 'null');} catch {fail();}
  const input=stored?.version===2&&object(stored.input)?stored.input:{enabled:false};
  // Accepting a review does not publish; the owner must explicitly save afterwards.
  const config={version:2,input,updatedAt:now.toISOString(),decision:{status:'NEEDS_INFORMATION',reasons:['review_accepted_save_required'],publicVerification:'pending'}};
  await client.write(snapshot,'NEEDS_INFORMATION',config,{...record,approvalProof:{...envelope,publicKey:env.NOTICE_REVIEW_PUBLIC_KEY}});
  return {accepted:true,status:'NEEDS_INFORMATION',publicVerification:'pending',reviewId:record.reviewId};
}
