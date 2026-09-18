# DEV theme invalidation — live validation

2026-09-16. Owner-authorized read_themes was granted to the installed DEV app. Worker 8753ee09 provides an owner-only read-only observation; it does not accept a review.

Shopify returned exactly one MAIN theme (159264309480), themesComplete=true, and exactly one text file sections/header-group.json, filesComplete=true. updatedAt=2026-09-13T20:53:33Z. Header SHA-256=9610db54990950982434ad1c686a29b72f1cd22840b9ed8ffcbb82b3ebdfddf3. Observed at 2026-09-16T16:36:33.517Z.

Fresh authenticated storefront review: home, /products/gift-card, /collections/automated-collection, /cart and /search each showed one real notice in section sections--22066757075176__17893321078e794eb7, before MainContent. Desktop home screenshot showed the link in normal flow below navigation without overlap. The store remains password protected; this is the admin-authenticated canonical storefront, not an anonymous shopper test. Phone and screen reader remain pending; no LIVE state or complete prominence certification is claimed.

This observation is the reviewed baseline for the gated invalidation trial. Retraction and recovery results are recorded below. Rollback code version before this turn: 17b639ba-558a-4663-8952-371674b415dc (commit 7ba12428). Audited code deployed in run 35122312347 as version 77a6c2db-6cda-4e8a-af98-84e55e04eb96; its health and negative authentication checks passed. No secrets were changed.

## Live invalidation and restoration trial

Guard deployment: commit 69e633aa, run 35123331937, Worker version 56ba93d7-0877-4519-ab45-2485e58d45bc. On reopening the owner app at 16:41:20 UTC, the unchanged review preserved configured state and displayed a dated successful revision observation.

The exact real Header section was removed and saved in the Horizon editor. Canonical /search then contained zero notice links and no reviewed section. Reopening the app at 16:42:06 UTC displayed the non-publicable configuration and an unsuccessful dated revision check.

The editor undo restored the same section and it was saved. An ordinary configuration save at 16:42:46 UTC still left the notice non-publicable; /search still had zero notice links. Thus restoring the section or saving cannot bypass the stale baseline.

A fresh owner-authenticated observation at 16:43:06.439 UTC returned the same theme, the same exact header hash 9610db54990950982434ad1c686a29b72f1cd22840b9ed8ffcbb82b3ebdfddf3, complete single-theme/single-file pagination, and new updatedAt=2026-09-16T16:42:44Z. The section was restored byte-for-byte in the Header file after the controlled undo; the operator renewed only the revision timestamp following this review. Recovery after deployment and explicit save is recorded below. No synthetic notice status, secret rotation or LIVE promotion was used.

## Recovery confirmed

Recovery baseline commit ffd9805ccc56a48fba3159f62a4fd375fb086ff4 deployed successfully in run 35123856543 as Worker version 25284877-dc1a-4bf3-9ed7-cc1edf9f5e82. Health and five negative authentication checks passed; the separate authenticated EVALUATE_TOKEN certification remains pending. All eight CI jobs passed.

Reopening the app at 16:46:15 UTC still showed the notice disabled: the read did not reactivate rejected state. Explicit configuration save at 16:46:32 UTC then displayed configured state and a dated unchanged-revision result. Canonical /search recovered exactly one notice in the reviewed section. Fresh checks of home, product, collection and cart also each showed exactly one notice in the same section. Horizon is restored; no synthetic status writes or LIVE promotion were used.

The observed runtime acceptance covers actual file name, pagination, physical section removal, app-opening invalidation, stale-review save rejection and explicit recovery after renewed review. It does not prove continuous monitoring, anonymous access, physical-phone behavior, screen-reader accessibility or Dawn compatibility. The 3 new observation tests bring the expected total to 173 (29 core + 81 Worker + 57 extension + 6 packaging). The read-only observation implementation in 8753ee09 is new code and remains available for independent review.
