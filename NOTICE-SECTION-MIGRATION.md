# Header-section migration (DEV)

This change adds a real `guarantee-notice-header` section block alongside the retained legacy embed. The DEV-only `guarantee-notice-section-dev` remains an inspection tool and cannot publish outside the editor.

The server accepts reviewed editor-placement evidence for the specific DEV shop and Horizon theme ID. This is pre-publication configuration evidence, not a public presentation audit. `CONFIGURED` permits the first real render; public verification stays pending and no LIVE state is assigned. The evidence record is `DEV-SECTION-COVERAGE.md`; its limitations remain binding.

On authenticated save, three compare-and-set metafields are written in one mutation: shop `notice_status`, app `notice_configuration` (version 2), and shop JSON `notice_presentation`. All succeed together or none do. The presentation contains version 1, mechanism `header-section`, reviewed theme ID, a technical `publicationReady` boolean and publicVerification `pending`. Failed or disabled configuration writes publicationReady false and null theme ID.

The header block requires the accepted core state, exact theme ID, boolean publicationReady, supported locale and Shopify's `section.location == header`. Missing/malformed binding, a different theme or moving the block into a template/footer suppresses it. The legacy embed suppresses itself once the header-section mechanism is written, even on failed configuration. Old stores without the new metafield retain their previous behavior until explicitly migrated; the embed file is not deleted.

Only the notice mechanism changes. The GARAN enabled metafield and permissions are not expanded. No credential is rotated.

Rule version 3 archives version 2 and extends product presentation policy to `header-section: supported_with_review`. The normative interpretation is unchanged; this is a product mechanism addition. It does not claim a section-group label proves prominence.

Onboarding recommends only the real header block, explicitly excludes the DEV inspection block, and says that saving has not confirmed public display. App Bridge reports section and legacy embed separately, without changing any server state or treating placement records as page coverage evidence. An unresolved extension handle remains unknown.

Runtime migration sequence: deploy validated code to DEV; add the real block to Header in Horizon draft; save through the authenticated app; verify rendering without the preview switch; inspect storefront pages and interactions; deactivate the old embed in the theme. Do not delete the old file or call the migration publicly verified before these checks. Dawn, physical phone and screen reader remain separate acceptance work. No production release, merge or expenditure is authorized by this document.
