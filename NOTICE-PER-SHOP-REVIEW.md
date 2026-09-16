# Per-installation review storage: migration candidate

Status: code candidate, not deployed or migrated. No new permissions, dependencies, credentials, paid services or production enablement. Existing DEV deployment and reference remain unchanged.

## What this implements

App-data metafield eu_store_guard.notice_review on the current AppInstallation, type json. Envelope version 1 binds the exact myshopify domain, Shopify Shop ID and AppInstallation ID (a reinstall cannot reuse another installation's review). The evidence retains the reviewed theme revision and scope. Data stays behind the app's Admin API access, not a storefront metafield.

When NOTICE_REVIEW_SOURCE=app-metafield, configuration and invalidation resolve the review from the same snapshot used for publication. Missing, malformed or foreign records do not fall back to NOTICE_DEPLOYMENT_EVIDENCE. Unknown nonempty source modes also fail closed. This mode requires the live theme comparison even if the older recheck flag is absent. The publication mutation includes the unchanged review value and its compareDigest alongside status, configuration and presentation, so a concurrent replacement rejects the whole mutation without retry.

## Explicit DEV migration

POST /app/migrate-review accepts only an empty JSON object, same-origin, authenticated shop owner and NOTICE_REVIEW_MIGRATION_ENABLED=true in DEV. It copies only the existing server-owned, operator-reviewed DEV evidence after configuration validation and a fresh comparison with the actual published theme. It creates the app-data record with compareDigest=null and refuses any existing record. It never sets notice_status, approves an observation or accepts client-supplied evidence. No UI invokes this endpoint automatically.

After independent review, a controlled DEV run can enable migration, execute once, verify the stored record, disable migration, and switch the source to app-metafield. Keep the former deployment reference until recovery is verified. Switching back is an explicit configuration rollback, never an automatic fallback. This sequence has NOT run.

## Deliberate limitations / release gates

This is storage and a narrowly scoped migration, not multi-merchant onboarding. The current runtime still restricts one DEV shop, and configurationDecision still requires the existing DEV review record. Creating, approving, renewing or revoking a new merchant's review needs a separate trusted operator workflow and review provenance; an owner checkbox or theme observation must not manufacture reviewed=true. No public visibility, prominence, physical-phone, screen-reader or continuous-monitoring claim follows from storage. No new customer is enabled by this patch.

The review field is the current baseline, not an immutable historical evidence ledger. Shopify configuration/theme writes are outside our transaction; CAS protects review/publication writes, not an atomic lock on theme edits. Checks remain intermittent.

## Validation

Nine additional executable tests cover identity/reinstall isolation, no fallback, migration without publication, stale/foreign/existing review rejection, four-field publication CAS and conflicts, missing-review retraction, migration authorization/body/origin/DEV gates, compulsory live comparison, and create-only conflicts. Worker suite: 90 passing (previously 81). Lint and secret scan pass. Existing dependencies, rules, assets and deployed settings are unchanged.

Sources: https://shopify.dev/docs/api/admin-graphql/latest/objects/AppInstallation and https://shopify.dev/docs/api/admin-graphql/latest/input-objects/MetafieldsSetInput .
