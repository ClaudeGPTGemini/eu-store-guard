# DEV theme invalidation — live validation

2026-09-16. Owner-authorized read_themes was granted to the installed DEV app. Worker 8753ee09 provides an owner-only read-only observation; it does not accept a review.

Shopify returned exactly one MAIN theme (159264309480), themesComplete=true, and exactly one text file sections/header-group.json, filesComplete=true. updatedAt=2026-09-13T20:53:33Z. Header SHA-256=9610db54990950982434ad1c686a29b72f1cd22840b9ed8ffcbb82b3ebdfddf3. Observed at 2026-09-16T16:36:33.517Z.

Fresh authenticated storefront review: home, /products/gift-card, /collections/automated-collection, /cart and /search each showed one real notice in section sections--22066757075176__17893321078e794eb7, before MainContent. Desktop home screenshot showed the link in normal flow below navigation without overlap. The store remains password protected; this is the admin-authenticated canonical storefront, not an anonymous shopper test. Phone and screen reader remain pending; no LIVE state or complete prominence certification is claimed.

This observation is the reviewed baseline for the gated invalidation trial. Retraction and recovery results are pending. Rollback code version before this turn: 17b639ba-558a-4663-8952-371674b415dc (commit 7ba12428). Audited code deployed in run 35122312347 as version 77a6c2db-6cda-4e8a-af98-84e55e04eb96; its health and negative authentication checks passed. No secrets were changed.
