# Dawn real configuration trial — 2026-09-16

## Scope
Password-protected DEV shop, existing authenticated browser. Not an anonymous customer test, physical phone or screen reader. No production publication, scope expansion, secret rotation, LIVE promotion, PR merge or spending.

## Configuration and isolation
Dawn 159296487656 received one real Header app block in sections--22076885434600__178933329392edae07. The older inspection block stayed disabled. After temporarily publishing Dawn, opening the app at 16:53:15Z invalidated Horizon's stored configuration. The observation returned complete single-theme/single-file pagination and the exact header filename. Dawn baseline updatedAt=2026-09-16T16:53:04Z, SHA-256=9d5759b70e1406bddbfa7c16ef41468cdab6d44e8e5b43b8722fa5f155dfd3f6.

Commit 856a75970c1442c3b52fa1f1a25a1dab5a79bc5a deployed in successful run 35125240285; all eight CI checks passed. Reloading the app did not revive invalidated state. Explicit ordinary owner configuration save at 16:59:48Z produced configured state and a dated unchanged-revision result. No synthetic status writes were used.

## Canonical storefront
A pre-existing Horizon preview session was detected and exited through Shopify's Exit preview control before accepting storefront observations. No preview bar remained. Dawn's own Header section identifiers confirmed the tested theme.

| Path | Result |
| --- | --- |
| / | One real notice, below native header and before hero |
| /products/gift-card | One real notice before product content |
| /collections/automated-collection | One real notice before collection content |
| /cart | One real notice before empty-cart content |
| /search | One real notice before search heading/form |

Full accessibility snapshots were used for cart and search after incremental snapshots omitted unchanged elements. The home screenshot showed the entry without covering menu, search or cart. Opening the notice placed focus on its heading and exposed Spanish transcription and links. Escape returned focus to its originating link. These are desktop browser observations, not a screen-reader certification or a full mobile audit.

## Restoration
Horizon was republished at 17:01:01Z. Opening the app at 17:01:12Z rejected Dawn's review; canonical cart no longer showed the notice. Fresh owner observation at 17:01:32.875Z returned Horizon 159264309480, complete pagination and original header hash 9610db54990950982434ad1c686a29b72f1cd22840b9ed8ffcbb82b3ebdfddf3. Only its revision timestamp was renewed after this byte-identity check. Recovery deployment and explicit save remain to be confirmed below.

## Remaining release work
Evidence still uses one DEV deployment variable rather than a per-shop persisted review. Onboarding text still names Horizon: Dawn support messaging needs a deliberate update before offering it. Checks run only on opening/saving, not continuously. Physical phone, real screen reader, commercial documents, authenticated EVALUATE_TOKEN certification and any release approval remain separate.
