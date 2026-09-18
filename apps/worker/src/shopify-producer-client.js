import { KEY, NS, LEGACY, SCHEMA } from './producer-import.js';
import { MAX_BYTES } from './producer-svg.js';

export function shopifyProducerClient({ shop, token, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)) }) {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) || !token) throw new Error('Shopify credentials/configuration missing');
  const endpoint = `https://${shop}/admin/api/2026-07/graphql.json`;
  const request = (url, options = {}) => fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
  async function graph(query, variables) {
    const response = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token }, body: JSON.stringify({ query, variables }) });
    if (!response.ok) throw new Error(`Shopify HTTP ${response.status}`);
    const json = await response.json();
    if (json.errors?.length || !json.data) throw new Error('Shopify GraphQL failure');
    for (const result of Object.values(json.data)) if (result?.userErrors?.length) throw new Error('Shopify mutation rejected');
    return json.data;
  }
  const https = value => {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) throw new Error('Invalid Shopify file endpoint');
    return u;
  };
  const cdn = value => { const u = https(value); if (u.hostname !== 'cdn.shopify.com') throw new Error('Unexpected file host'); return u.href; };
  return {
    async ensureDefinition() {
      const data = await graph(`query Definition($ns:String!,$key:String!){metafieldDefinitions(first:2,ownerType:PRODUCT,namespace:$ns,key:$key){nodes{id type{name} validations{name value}}}}`, { ns: NS, key: KEY });
      const nodes = data.metafieldDefinitions.nodes;
      if (nodes.length) {
        const schema = nodes[0].validations.find(x => x.name === 'schema')?.value;
        if (nodes.length !== 1 || nodes[0].type.name !== 'json' || schema !== JSON.stringify(SCHEMA)) throw new Error('Existing definition differs; explicit migration required');
        return;
      }
      await graph(`mutation DefinitionCreate($definition:MetafieldDefinitionInput!){metafieldDefinitionCreate(definition:$definition){createdDefinition{id} userErrors{field message}}}`, { definition: { name: 'GARAN producer assets v1', namespace: NS, key: KEY, ownerType: 'PRODUCT', type: 'json', access: { storefront: 'PUBLIC_READ' }, validations: [{ name: 'schema', value: JSON.stringify(SCHEMA) }] } });
    },
    async read(ownerId) {
      const data = await graph(`query ProducerState($id:ID!){product(id:$id){id metafield(namespace:"${NS}",key:"${KEY}"){value compareDigest}}}`, { id: ownerId });
      if (!data.product) throw new Error('Product not found');
      return data.product.metafield;
    },
    async write(ownerId, value, compareDigest) {
      const data = await graph(`mutation ProducerSet($metafields:[MetafieldsSetInput!]!){metafieldsSet(metafields:$metafields){metafields{value compareDigest} userErrors{field message code}}}`, { metafields: [{ ownerId, namespace: NS, key: KEY, type: 'json', value: JSON.stringify(value), compareDigest }] });
      const written = data.metafieldsSet.metafields?.[0];
      if (!written?.compareDigest || written.value !== JSON.stringify(value)) throw new Error('Unconfirmed metafield write');
      return written;
    },
    async removeLegacy(ownerId) {
      await graph(`mutation LegacyDelete($metafields:[MetafieldIdentifierInput!]!){metafieldsDelete(metafields:$metafields){deletedMetafields{key} userErrors{field message}}}`, { metafields: LEGACY.map(key => ({ ownerId, namespace: NS, key })) });
    },
    async upload(bytes, filename, onCreated) {
      const data = await graph(`mutation Stage($input:[StagedUploadInput!]!){stagedUploadsCreate(input:$input){stagedTargets{url resourceUrl parameters{name value}} userErrors{field message}}}`, { input: [{ filename, mimeType: 'image/svg+xml', resource: 'FILE', httpMethod: 'POST', fileSize: String(bytes.length) }] });
      const target = data.stagedUploadsCreate.stagedTargets?.[0];
      if (!target) throw new Error('Missing staged upload');
      const u = https(target.url);
      if (!(u.hostname === 'storage.googleapis.com' || u.hostname.endsWith('.storage.googleapis.com') || u.hostname.endsWith('.shopify.com'))) throw new Error('Unexpected upload host');
      https(target.resourceUrl);
      const form = new FormData();
      for (const parameter of target.parameters) form.append(parameter.name, parameter.value);
      form.append('file', new Blob([bytes], { type: 'image/svg+xml' }), filename);
      if (!(await request(u.href, { method: 'POST', body: form })).ok) throw new Error('Staged upload failed');
      const created = await graph(`mutation CreateFile($files:[FileCreateInput!]!){fileCreate(files:$files){files{id fileStatus} userErrors{field message}}}`, { files: [{ originalSource: target.resourceUrl, contentType: 'FILE', filename, duplicateResolutionMode: 'RAISE_ERROR' }] });
      const id = created.fileCreate.files?.[0]?.id;
      if (!/^gid:\/\/shopify\/GenericFile\/\d+$/.test(id ?? '')) throw new Error('Expected GenericFile');
      onCreated(id);
      for (let attempt = 0; attempt < 8; attempt++) {
        const status = await graph('query FileStatus($id:ID!){node(id:$id){... on GenericFile{id fileStatus url}}}', { id });
        const file = status.node;
        if (file?.fileStatus === 'READY' && file.url) return { id, url: cdn(file.url) };
        if (!file || file.fileStatus === 'FAILED') throw new Error('File processing failed');
        await sleep(1000);
      }
      throw new Error('File processing timed out');
    },
    async download(url) {
      const response = await request(cdn(url));
      if (!response.ok || !response.body) throw new Error('Cannot verify served asset');
      const reader = response.body.getReader(), chunks = [];
      let length = 0;
      try {
        while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > MAX_BYTES) throw new Error('Served asset exceeds size limit'); chunks.push(value); }
      } finally { await reader.cancel(); }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return bytes;
    }
  };
}
