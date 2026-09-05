# Qué hace el socio (solo navegador, sin tokens, sin instalar nada)

1. GitHub → repositorio privado `eu-store-guard` → "Add file → Upload files" → arrastrar el contenido de este ZIP → Commit.
2. Comprobar en la pestaña "Actions" que los cuatro checks (lint, test, build, audit) salen en verde.
3. Cloudflare → Workers & Pages → Create → "Connect to Git" → autorizar la GitHub App de Cloudflare solo para `eu-store-guard` → root directory `apps/worker` → deploy command `npx wrangler deploy`. Sin secretos todavía.
4. Shopify Partners → Apps → Create app → tipo "Custom / from scratch" → nombre "EU Store Guard DEV". Crear una development store. No copiar el Client Secret a ningún sitio salvo, cuando se indique, al panel de Cloudflare (Settings → Variables → Secret).
5. Escribir "infra DEV lista".
