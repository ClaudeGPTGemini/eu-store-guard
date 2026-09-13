# Real Horizon notice flow — DEV, 2026-09-13

Code: `7ba124289494f18287aae8c2419bf0b0be30d907`. Shopify version `eu-store-guard-dev-13` (`1127155073025`). Worker deploy run `34781996215` succeeded, including health and unauthenticated-boundary checks. No secret was changed.

## What was executed

The real `Aviso garantía (Header)` block was added to the Header group in Horizon `159264309480`. Its section is `sections--22066757075176__17893321078e794eb7`. The older editor-only inspection block remains switched off. The legacy embed was switched off and saved after the real block rendered.

The owner-authenticated app saved the existing B2C/Spain/Spanish configuration through its real endpoint. It wrote CONFIGURED and the presentation binding atomically. No status was written manually and no preview switch enabled publication. The banner in the app still says public display has not been confirmed automatically.

Horizon was then made the active theme of the **password-protected development store**, replacing `test-data` (retained as a draft). This is not a production launch. The normal storefront URL was visited without editor or preview-theme query parameters. The authenticated browser retained Shopify's preview/admin toolbar, but Horizon was the active theme; no claim of an anonymous-browser or password-free test is made.

## Five real storefront routes

| Route | Notice count | State | Above main content | Clear of header | DEV preview markup |
| --- | --- | --- | --- | --- | --- |
| `/` | 1 | CONFIGURED | yes | yes | absent |
| `/products/gift-card` | 1 | CONFIGURED | yes | yes | absent |
| `/collections/automated-collection` | 1 | CONFIGURED | yes | yes | absent |
| `/cart` | 1 | CONFIGURED | yes | yes | absent |
| `/search` | 1 | CONFIGURED | yes | yes | absent |

The link was in the initial viewport on all five desktop routes. Its measured hit box was approximately 247 by 44 CSS pixels. Screenshots and rendered DOM were inspected; no DOM was modified to fabricate a result.

At 375 by 812 on Search, the link was visible without horizontal clipping. Clicking opened the actual native dialog within the viewport, with initial focus on the heading. Both the close button and Escape closed it and returned focus to the original link. The temporary viewport override was reset. This is responsive-browser evidence, not a physical phone or screen reader test.

## Retraction and restoration

Using the app form, enabled was switched off and saved. Reloading the real storefront showed zero notice instances, with state and ready diagnostics false. Enabled was then switched on and saved again. Reloading showed one CONFIGURED notice. This verifies real write-to-render retraction and restoration. Final merchant configuration is enabled.

## Runtime findings corrected

1. Shopify rejected the initial block display name because it exceeded 25 characters. The name was shortened and packaged schema names are now checked.
2. The initial implementation assumed app blocks could read parent section.location and Liquid theme.id. Live boolean diagnostics disproved that assumption; official documentation excludes parent section properties other than id and deprecates theme. The final code uses supported section.id plus schema enabled_on.groups=[header]. Missing or wrong section binding remains closed. Theme ID is review metadata, not a runtime guarantee.

## Remaining limits

The App Bridge observation still reports `handle_or_type_mismatch`. It remains informational and does not write a LIVE state. Direct storefront evidence above does not silently change its result. The implementation has not been independently audited yet.

Dawn has separate initial editor-only evidence in `DEV-DAWN-EDITOR-COVERAGE.md`; its real configuration flow is not tested. Physical phone, real screen reader, wider page/alternate-template coverage, customer onboarding and final prominence assessment remain open. CONFIGURED is not LIVE_VERIFIED, legal compliance certification or readiness to sell. The four valid-token Worker DEV checks are still not completed by the deployment's negative-auth tests.

CI on the code commit is green. Tests: core 29 + Worker 63 + extension 57 + packaging 6 = 155. Assets: 26 original files verified. Local Wrangler dry-run encountered the Windows sandbox path restriction; Linux CI build passed. PR #3 remains unmerged. No production deployment or expenditure; EUR 0.
