# End-of-document candidate — 2026-09-13

Purpose: inspect the existing inline position in normal document flow in test-data and Horizon, without changing host body/header styles, relocating DOM nodes with JavaScript, or changing a core state.

The canonical inline CSS is static and scoped to .esg-notice. The DEV-only opt-in preview now accepts inline as well as top-bar. The source template still blocks inline outside this DEV inspection. The core remains version 2, presentation policy version 1: inline is review_required with no accepted entry point. No review approval, NOTICE_DEPLOYMENT_EVIDENCE or synthetic status is introduced.

The Commission guidance section 2.3 requires prominent display and default-size legibility; its placement examples are non-exhaustive. Presence at the document end is not, by itself, proof of prominence. Theme app embeds also do not establish checkout or confirmation-email coverage. Source: https://commission.europa.eu/document/download/3e4dbee6-8184-4256-923d-c52551c7e9f0_en

Pre-deployment checks: 57 extension tests, 5 packaging tests, lint and secret scan passed. The new render test verifies the native asset link and that inline remains absent outside the editor even with CONFIGURED or LIVE_VERIFIED and a saved preview checkbox. Official assets are unchanged.

Field review pending: home and product pages, desktop/mobile editor layouts, visibility after scrolling, modal and menu behavior. No physical-phone or real screen-reader result is implied.

## DEV comparison results

Candidate source: a23ecfbf89a1aaa9e0bbe3f2ecb1a22b471cab42. Shopify version eu-store-guard-dev-9 (1127118929921), DEV only. The main CI, Theme Extension and DEV upload runs all passed: 34778776593, 34778776545 and 34778774574. Worker v24 and its configuration were not changed.

Observed in Shopify's editor, using the explicit DEV preview with the real non-publicable status:

- test-data home page, desktop and mobile editor: the entry appears after the existing footer and payment/privacy links, occupies its own space, and does not cover header navigation. It is not visible at the top of the page.
- Horizon home page: the entry appears after the footer; the header stays separate. The modal opens from the native entry link and Escape returns focus to it. The mobile modal fits the editor viewport with a visible close control. The small default SVG text remains a legibility limitation; the text transcript and full-size link remain present.
- Both mobile menus open with their own Home/Catalog/Contact entries and close with Escape; the notice does not cover their controls in the inspected layouts.
- Horizon was also inspected after saving the DEV-only checkbox and reloading, to avoid relying only on its asynchronous partial preview. Preview settings must be restored after inspection.

The fixed DEV inspection label initially obscured part of the end-of-page link; candidate 9 moves that label into normal flow too. It is explicitly test instrumentation and not part of the public render.

Decision: the observed fixed-bar/header collision is avoided by this candidate. This is not approval of prominence. Finding a link only after the entire page and footer is not evidence that buyers notice it. Section 2.3 does not make page-wide presence a substitute for prominence. No claim of universal theme compatibility, checkout coverage, public-storefront verification, physical-phone testing, or real screen-reader testing follows from this comparison. Product-page checks remain pending.

The canonical public render remains blocked for inline under the unchanged policy. No evidence approval, synthetic notice_status, LIVE state or credential change was made. PR #3 remains unmerged, production remains blocked, and spending is zero.

Cleanup: test-data returned to its saved top-bar position with DEV preview off. Horizon was restored and saved with its original bottom-right position and DEV preview off. Mobile editor mode was turned off in both. The inspection settings are not left active.
