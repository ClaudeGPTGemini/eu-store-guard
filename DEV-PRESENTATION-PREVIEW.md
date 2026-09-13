# DEV presentation inspection — 2026-09-13

v24 is deployed to the DEV Worker (version 79916d88-71f2-4025-9a9e-8f78d5b79332) and Shopify candidate eu-store-guard-dev-6 is active. The published DEV theme test-data (159264407784) has the notice enabled with top-bar. Health and five negative authentication checks passed. Authenticated DEV certification is still pending.

Presentation review cannot be claimed before rendering. The server still rejects missing NOTICE_DEPLOYMENT_EVIDENCE; no reviewed flag, synthetic notice_status, or LIVE state has been written.

The DEV packager now adds an explicitly opt-in inspection mode. It requires all of: Shopify's server-provided request.design_mode boolean, the exact DEV shop permanent domain, the editor checkbox boolean, a supported packaged locale and top-bar. It preserves the actual status in HTML and labels the preview as neither publication nor verification. Outside the editor the original state gate remains intact, even if the checkbox is saved. The canonical extension has no preview bypass.

Shopify cautions against making editor previews differ from customer behavior (https://shopify.dev/docs/api/liquid/objects/request). This is therefore an explicitly labelled DEV inspection aid, not a customer configuration flow or evidence of live publication. Disable it after inspection. It must not be promoted into a production package. No query-string switch or browser-written status enables it.

Validation: four packaging tests pass, including actual Liquid rendering for all preview gates, unchanged official assets, locale suppression and live-store fail-closed behavior; lint and secret scan pass. The previously audited core, Worker and canonical extension are unchanged.

Visual inspection, actual public rendering, physical phone and real screen reader remain separate checks. This preview does not provide any of those results by itself.
