// Offline operator tool. Never creates a key or contacts Shopify.
import {readFileSync,writeFileSync} from 'node:fs';
import {createPrivateKey,sign} from 'node:crypto';
import {approvalEvidence} from '../apps/worker/src/notice-assisted-review.js';

const [reviewPath,keyPath,outputPath]=process.argv.slice(2);
if(!reviewPath||!keyPath||!outputPath)throw new Error('Usage: node scripts/sign-notice-review.mjs review.json private-key.pem approval.json');
const bytes=readFileSync(reviewPath);
const record=JSON.parse(bytes);
if(!approvalEvidence(record))throw new Error('Review is incomplete or outside its validity period');
const key=createPrivateKey(readFileSync(keyPath));
if(key.asymmetricKeyType!=='ed25519')throw new Error('An Ed25519 operator key is required');
const result=JSON.stringify({payload:bytes.toString('base64url'),signature:sign(null,bytes,key).toString('base64url')});
if(Buffer.byteLength(result)>4096)throw new Error('Approval exceeds endpoint size limit');
// Exclusive creation: never overwrite an earlier approval artifact or key.
writeFileSync(outputPath,result+'\n',{flag:'wx',mode:0o600});
