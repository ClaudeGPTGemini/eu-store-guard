# Header-section migration (DEV)

This change adds a real `guarantee-notice-header` section block alongside the retained legacy embed. The DEV-only `guarantee-notice-section-dev` remains an inspection tool and cannot publish outside the editor.

The server accepts reviewed editor-placement evidence for the specific DEV shop and Horizon theme ID. This is pre-publication configuration evidence, not a public presentation audit. `CONFIGURED` permits the first real render; public verification stays pending and no LIVE state is assigned. The evidence record is `DEV-SECTION-COVERAGE.md`; its limitations remain binding.

On authenticated save, three compare-and-set metafields are written in one mutation: shop `notice_status`, app `notice_configuration` (version 2), and shop JSON `notice_presentation`. All succeed together or none do. The presentation contains version 1, mechanism `header-section`, reviewed theme and section IDs, a technical `publicationReady` boolean and publicVerification `pending`. Failed or disabled configuration writes publicationReady false and null theme ID.

The header block requires the accepted core state, exact reviewed section ID, boolean publicationReady and supported locale. The schema restricts the block to the Header group via `enabled_on.groups`. Missing/malformed binding, a different section suppresses it. The legacy embed suppresses itself once the header-section mechanism is written, even on failed configuration. Old stores without the new metafield retain their previous behavior until explicitly migrated; the embed file is not deleted.

Only the notice mechanism changes. The GARAN enabled metafield and permissions are not expanded. No credential is rotated.

Rule version 3 archives version 2 and extends product presentation policy to `header-section: supported_with_review`. The normative interpretation is unchanged; this is a product mechanism addition. It does not claim a section-group label proves prominence.

Onboarding recommends only the real header block, explicitly excludes the DEV inspection block, and says that saving has not confirmed public display. App Bridge reports section and legacy embed separately, without changing any server state or treating placement records as page coverage evidence. An unresolved extension handle remains unknown.

Runtime migration sequence: deploy validated code to DEV; add the real block to Header in Horizon draft; save through the authenticated app; verify rendering without the preview switch; inspect storefront pages and interactions; deactivate the old embed in the theme. Do not delete the old file or call the migration publicly verified before these checks. Dawn, physical phone and screen reader remain separate acceptance work. No production release, merge or expenditure is authorized by this document.

Runtime correction: app extensions cannot read section.location and Liquid theme is deprecated. The initial guards were rejected in the live DEV test and replaced by supported section.id plus the schema group restriction. Theme ID is review metadata, not a claimed runtime theme check. Copying an entire reviewed configuration needs re-review; no universal anti-copy guarantee is claimed.

## Rule version provenance

The machine-readable record `packages/core/rule-history/EU_LEGAL_GUARANTEE_NOTICE_2026_01.v3-revision.json` records the v2-to-v3 product-policy change and binds both rule versions by the same SHA-256 serialization used in the Evidence Log. The retained `interpretation_revision` describes the earlier v1-to-v2 normative correction; it is not the version history of every subsequent product-policy change. The provenance record was added on 2026-09-16 after the audit of `a16db964`, without rewriting the audited rule or its hash.
