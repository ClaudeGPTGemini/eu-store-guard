# DEV presentation inspection — 2026-09-13

v24 is deployed to the DEV Worker (version 79916d88-71f2-4025-9a9e-8f78d5b79332) and Shopify candidate eu-store-guard-dev-6 is active. The published DEV theme test-data (159264407784) has the notice enabled with top-bar. Health and five negative authentication checks passed. Authenticated DEV certification is still pending.

Presentation review cannot be claimed before rendering. The server still rejects missing NOTICE_DEPLOYMENT_EVIDENCE; no reviewed flag, synthetic notice_status, or LIVE state has been written.

The DEV packager now adds an explicitly opt-in inspection mode. It requires all of: Shopify's server-provided request.design_mode boolean, the exact DEV shop permanent domain, the editor checkbox boolean, a supported packaged locale and top-bar. It preserves the actual status in HTML and labels the preview as neither publication nor verification. Outside the editor the original state gate remains intact, even if the checkbox is saved. The canonical extension has no preview bypass.

Shopify cautions against making editor previews differ from customer behavior (https://shopify.dev/docs/api/liquid/objects/request). This is therefore an explicitly labelled DEV inspection aid, not a customer configuration flow or evidence of live publication. Disable it after inspection. It must not be promoted into a production package. No query-string switch or browser-written status enables it.

Validation: four packaging tests pass, including actual Liquid rendering for all preview gates, unchanged official assets, locale suppression and live-store fail-closed behavior; lint and secret scan pass. The previously audited core, Worker and canonical extension are unchanged.

Visual inspection, actual public rendering, physical phone and real screen reader remain separate checks. This preview does not provide any of those results by itself.

## Actual inspection result: BLOCKED

The helper was released only to EU Store Guard DEV as eu-store-guard-dev-7 (Shopify version 1127108345857, source b4705267a1e65676288e89b3e530f60c6f74f225). Its upload, main CI and Theme Extension workflows all passed (runs 34777749398, 34777751413 and 34777751366).

In Shopify's editor for published theme test-data, enabling the opt-in preview places the fixed top-bar over the theme's navigation. The black header's Home, Catalog, Contact, search, account and cart controls reappear when the preview is disabled. The editor's mobile layout exhibits the same overlap. This is an observed collision, not proof of a device or screen-reader result. No pixel measurements are claimed.

The underlying cause is the v24 fixed top:0 bar without space reserved by the host layout. A visual label named top-bar does not resolve layout integration. Presentation review is rejected; do not set reviewed:true or supply publication evidence on the basis of this inspection.

At the end, the preview checkbox is OFF, mobile preview is OFF, and Save is disabled (no unsaved changes). The actual saved top-bar setting and enabled app embed remain. No notice_status was manually written, no LIVE state was assigned, and no EVALUATE_TOKEN or other secret was changed. The notice is still suppressed by the existing server review gate. Worker v24 remains deployed; PR #3 remains unmerged and spending remains zero.

Next implementation must reserve real space for the entry point and avoid covering the theme's navigation, including sticky headers and mobile menus, before review can pass. The DEV preview provides a way to test that correction without changing public status. Do not treat this report as completion of publication from real configuration.
