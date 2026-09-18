import { inspectSvg, sha256 } from './producer-svg.js';

export const NS = 'eu_store_guard';
export const KEY = 'garan_assets_v1';
export const LEGACY = ['garan_producer_asset', 'garan_producer_nested_asset', 'garan_producer_asset_width', 'garan_producer_asset_height', 'garan_producer_nested_width', 'garan_producer_nested_height'];
const assetSchema = { type: 'object', additionalProperties: false, required: ['url', 'width', 'height', 'sha256', 'fileId'], properties: {
  url: { type: 'string', pattern: '^https://cdn\\.shopify\\.com/', maxLength: 2048 },
  width: { type: 'integer', minimum: 1, maximum: 100000 }, height: { type: 'integer', minimum: 1, maximum: 100000 },
  sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, fileId: { type: 'string', pattern: '^gid://shopify/GenericFile/[0-9]+$' }
} };
export const SCHEMA = { type: 'object', additionalProperties: false, required: ['state', 'operation'], properties: {
  state: { enum: ['BLOCKED', 'READY'] }, operation: { type: 'string', minLength: 1, maxLength: 64 }, full: assetSchema, nested: assetSchema
}, allOf: [{ if: { properties: { state: { const: 'READY' } } }, then: { required: ['full', 'nested'] } }] };

// No caller URL or dimensions. A persisted block is acquired before inspecting input.
// Failures retain BLOCKED. A crashed operation needs explicit reconciliation, never auto-unlock.
export async function importProducerPair({ client, ownerId, full, nested }) {
  if (!/^gid:\/\/shopify\/Product\/\d+$/.test(ownerId)) throw new Error('Invalid product owner');
  const current = await client.read(ownerId);
  if (current && JSON.parse(current.value).state !== 'READY') throw new Error('Import already blocked; reconcile before retry');
  const operation = crypto.randomUUID();
  const blocked = { state: 'BLOCKED', operation };
  const lock = await client.write(ownerId, blocked, current?.compareDigest ?? null);
  if (!lock?.compareDigest) throw new Error('Missing lock acknowledgement');
  const fileIds = [];
  try {
    const inputs = [inspectSvg(full), inspectSvg(nested)];
    const assets = [];
    for (const [index, input] of inputs.entries()) {
      const hash = await sha256(input.bytes);
      const file = await client.upload(input.bytes, `esg-${index}-${hash}-${operation}.svg`, id => fileIds.push(id));
      // URL comes exclusively from Shopify, and served bytes must match too.
      const downloaded = await client.download(file.url);
      if (await sha256(downloaded) !== hash) throw new Error('Served file differs from uploaded bytes');
      assets.push({ url: file.url, fileId: file.id, sha256: hash, width: input.width, height: input.height });
    }
    // Deletion is separate from metafieldsSet. The persisted block covers this gap.
    await client.removeLegacy(ownerId);
    const ready = { state: 'READY', operation, full: assets[0], nested: assets[1] };
    await client.write(ownerId, ready, lock.compareDigest);
    return { ownerId, operation, fileIds, state: 'READY' };
  } catch (error) {
    // Uploaded IDs remain recorded for review. Never delete after an ambiguous commit:
    // Shopify may have committed READY even if its response was lost.
    const failure = new Error('Import did not confirm completion; inspect persisted state before retry');
    failure.cause = error;
    failure.operation = operation;
    failure.fileIds = fileIds;
    throw failure;
  }
}
