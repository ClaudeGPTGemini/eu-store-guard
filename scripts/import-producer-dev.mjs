import { readFileSync } from 'node:fs';
import { importProducerPair } from '../apps/worker/src/producer-import.js';
import { shopifyProducerClient } from '../apps/worker/src/shopify-producer-client.js';

// Explicit operator command. Not wired to a public Worker route or automatic workflow.
const [ownerId, fullPath, nestedPath] = process.argv.slice(2);
if (!ownerId || !fullPath || !nestedPath || process.env.SHOPIFY_SHOP !== 'eu-store-guard-dev.myshopify.com' || process.env.ESG_ENABLE_DEV_IMPORT !== 'reviewed-theme-installed') {
  throw new Error('Reviewed theme prerequisite, DEV store and product ID, full SVG path, nested SVG path required');
}
const client = shopifyProducerClient({ shop: process.env.SHOPIFY_SHOP, token: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN });
try {
  const full = new Uint8Array(readFileSync(fullPath)), nested = new Uint8Array(readFileSync(nestedPath));
  await client.ensureDefinition();
  console.log(JSON.stringify(await importProducerPair({ client, ownerId, full, nested })));
} catch (error) {
  // Never print credentials, signed staged URLs or raw server responses.
  console.error(JSON.stringify({ error: 'Import not confirmed', operation: error.operation, fileIds: error.fileIds }));
  process.exitCode = 1;
}
