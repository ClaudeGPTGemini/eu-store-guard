# Server-side theme invalidation — candidate, not deployed

This candidate adds an owner-authenticated POST `/app/recheck-theme` and a server-side Admin GraphQL query for the MAIN theme and `sections/header-group.json`. It never trusts an App Bridge result or a theme identifier supplied by the browser.

## Executable behavior

When `NOTICE_THEME_RECHECK_ENABLED=true`, opening an existing enabled header-section configuration calls the endpoint. Normal configuration saves also check the theme revision **before** writing a publishable state, so saving cannot bypass an invalidated review. New configurations and legacy installations do not auto-migrate through the diagnostic endpoint.

The server's deployment evidence must contain `themeRevision` with `reviewed:true`, the same numeric-string `themeId`, exact Admin `updatedAt`, `reviewedAt` and SHA-256 `headerSha256` of the reviewed Header group file. These values must be obtained during a real, reviewed observation; no baseline is auto-accepted from the current response. The existing live deployment has no such baseline and the feature flag is absent. Enabling it without a proper baseline will retract publication.

A different published theme, modified theme timestamp, changed Header group bytes (including deletion or disabling of the section), missing file, incomplete/ambiguous response or API failure causes NEEDS_INFORMATION and publicationReady=false through the existing atomic three-metafield CAS writer. NOT_APPLICABLE stays non-publicable. Conflicts fail and are not retried. Legacy data without the new presentation envelope returns a migration error without silently changing it.

An unchanged review can only preserve an already CONFIGURED, enabled, publicationReady configuration. It cannot promote a rejected state or any LIVE state, and cannot establish visibility, prominence, accessibility or coverage. Public verification remains pending. Timestamp is a revision marker, not the theme vendor's semantic version. Full file hashing deliberately invalidates even benign Header changes: they require renewed review. The previous core evaluation log remains historical input; the new themeCheck records the current invalidation separately.

## Limits and activation prerequisites

- Requires `read_themes`, documented by Shopify. The current app has only read_locales. No scope, token or deployment was changed for this candidate.
- Requires a real baseline for the published theme and a fresh review after any theme change. It must include the actually rendered section/block and its context; matching bytes alone cannot make an unreviewed baseline valid.
- This is a check on app opening and configuration save, **not a background monitor**. A deletion while the app remains closed can leave persisted state stale. A theme can also change between observation and mutation; metafield CAS protects configuration concurrency, not a transaction with Shopify theme edits. These are still release gates. No continuous theme isolation is claimed.
- No production activation, no offline-token storage, no automatic grant of new permissions, no new cron, and no change to the frozen regulatory interpretation.

## Tests and execution status

13 new tests cover exact-theme matching despite identical bytes, physical removal, revision changes, API errors, incomplete data, bad baselines, non-reactivation, CAS conflict, legacy preservation, route authentication/origin/input checks and the normal-save bypass. They execute the actual client query and mutation path with controlled Shopify responses; the route test includes a signed session token. They are not live Shopify certification.

The whole Worker suite was rerun: 76/76, zero failures/skips. Lint and secret scan passed. Other unchanged suites were previously 29 core + 57 extension + 6 packaging; combined expected total is now 168. A fresh installation and independent review remain separate work.

Sources: https://shopify.dev/docs/api/admin-graphql/2026-07/queries/themes and https://shopify.dev/docs/api/admin-graphql/2026-07/objects/OnlineStoreTheme .

## Historical UI summary (2026-09-16)

GET, save and theme recheck responses now expose only a validated historical timestamp and whether that observation matched the reviewed revision. Missing, invalid or future dates produce no summary. The UI labels the date as the last attempt, describes the observation in the past, and explicitly says there is no continuous monitoring and no confirmation of visibility. A failed observation is not displayed as a successful check. Configuration saves record the attempted theme check when the guard executes; ordinary configuration updates do not masquerade as theme-check dates. The whole Worker suite is now 78/78; lint and secret scan pass. This remains undeployed and requires independent review and live prerequisites already listed above.
