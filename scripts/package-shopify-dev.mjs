import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function packageDev({ locales = ['es'], output, source = join(root, 'extensions/eu-store-guard') } = {}) {
  if (!output || existsSync(output)) throw new Error('Output must be a new directory');
  locales = [...new Set(locales)].sort();
  if (!locales.length || locales.some(l => !/^[a-z]{2}$/.test(l))) throw new Error('Invalid locales');
  const manifestBytes = readFileSync(join(source, 'assets-manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  const transcription = JSON.parse(readFileSync(join(source, 'transcriptions/es.json')));
  if (transcription.status !== 'visually-checked' ||
      transcription.assetSha256 !== manifest.assets['notice-es-rgb.svg'].sha256 ||
      transcription.transcriptSha256 !== sha(readFileSync(join(source, 'snippets/notice-transcript-es.liquid')))) {
    throw new Error('Spanish transcription requires review against current asset');
  }
  // Verify ALL approved originals, including languages omitted from this DEV package.
  for (const [name, entry] of Object.entries(manifest.assets)) {
    if (!/^[a-z-]+\.svg$/.test(name)) throw new Error('Invalid manifest path');
    const bytes = readFileSync(join(source, 'assets', name));
    if (sha(bytes) !== entry.sha256 || bytes.length !== entry.bytes) throw new Error(`Integrity failure: ${name}`);
  }
  const selected = [...locales.map(l => `notice-${l}-rgb.svg`), 'garan-rgb.svg', 'garan-nested-rgb.svg'];
  if (selected.some(name => !manifest.assets[name])) throw new Error('Locale absent from approved manifest');
  const files = new Map();
  for (const dir of ['blocks', 'locales', 'snippets']) {
    for (const name of readdirSync(join(source, dir))) {
      if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new Error('Invalid source path');
      files.set(`${dir}/${name}`, readFileSync(join(source, dir, name)));
    }
  }
  for (const name of [...selected, 'eu-store-guard.css', 'eu-store-guard.js']) files.set(`assets/${name}`, readFileSync(join(source, 'assets', name)));
  // Keep the official EU locale list; independently gate the locales actually shipped.
  const key = 'blocks/guarantee-notice.liquid';
  let liquid = files.get(key).toString();
  const anchor = '{%- if can_render and supported -%}';
  if (liquid.split(anchor).length !== 2) throw new Error('Notice template changed; review packaging transform');
  liquid = liquid.replace(anchor, `{%- assign packaged_locales = '${locales.join(',')}' | split: ',' -%}\n{%- unless packaged_locales contains current -%}{%- assign supported = false -%}{%- endunless -%}\n${anchor}`);
  // DEV-only, explicit editor preview. Never writes or fabricates a core state.
  // All three gates are server-rendered; query parameters cannot enable it.
  liquid = liquid.replace(anchor, `{%- assign esg_dev_preview = false -%}
{%- if request.design_mode == true and shop.permanent_domain == 'eu-store-guard-dev.myshopify.com' and block.settings.esg_dev_preview == true and position == 'top-bar' and supported -%}
  {%- assign esg_dev_preview = true -%}
  {%- assign can_render = true -%}
{%- endif -%}
{%- if esg_dev_preview -%}
  <aside data-esg-dev-preview="editor-only" style="position:fixed;bottom:0;left:0;z-index:1001;background:#fff;color:#172b4d;border:2px solid #003399;padding:.5rem;max-width:100%;box-sizing:border-box" role="status">Vista previa de desarrollo. No confirma publicación ni verificación.</aside>
{%- endif -%}
${anchor}`);
  const schemaMatch = liquid.match(/{% schema %}([\s\S]*?){% endschema %}/);
  if (!schemaMatch) throw new Error('Notice schema missing');
  const schema = JSON.parse(schemaMatch[1]);
  schema.settings.push({type:'checkbox',id:'esg_dev_preview',label:'Vista previa DEV (solo editor)',default:false,
    info:'Muestra una prueba visual aunque la configuración esté pendiente. No publica ni verifica el aviso.'});
  liquid = liquid.replace(schemaMatch[0], `{% schema %}\n${JSON.stringify(schema,null,2)}\n{% endschema %}`);
  files.set(key, Buffer.from(liquid));
  files.set('shopify.extension.toml', Buffer.from('name = "EU Store Guard DEV"\ntype = "theme"\nhandle = "eu-store-guard"\n'));
  const total = [...files.values()].reduce((n, b) => n + b.length, 0);
  if (total > 10_000_000) throw new Error(`Extension exceeds conservative 10 MB limit: ${total}`);
  const extension = join(output, 'extensions/eu-store-guard');
  for (const [path, bytes] of files) {
    const target = join(extension, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  writeFileSync(join(output, 'shopify.app.dev.toml'), readFileSync(join(root, 'shopify.app.dev.toml')));
  writeFileSync(join(output, 'package.json'), JSON.stringify({name:'eu-store-guard-dev-package',private:true}, null, 2) + '\n');
  const report = {purpose:'DEV ONLY — selected locales; not EU-wide release', locales, extensionBytes:total, sourceManifestSha256:sha(manifestBytes), officialAssets:Object.fromEntries(selected.map(n => [n, manifest.assets[n]])), files:Object.fromEntries([...files].sort(([a],[b]) => a.localeCompare(b)).map(([n,b]) => [n,{bytes:b.length,sha256:sha(b)}]))};
  writeFileSync(join(output, 'package-manifest.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = packageDev({output:resolve(process.argv[2] || '.scratch/shopify-dev-es'),locales:(process.argv[3] || 'es').split(',')});
  console.log(JSON.stringify({locales:report.locales,extensionBytes:report.extensionBytes,officialAssets:Object.keys(report.officialAssets).length}));
}
