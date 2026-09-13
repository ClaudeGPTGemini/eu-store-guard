# End-of-document candidate — 2026-09-13

Purpose: inspect the existing inline position in normal document flow in test-data and Horizon, without changing host body/header styles, relocating DOM nodes with JavaScript, or changing a core state.

The canonical inline CSS is static and scoped to .esg-notice. The DEV-only opt-in preview now accepts inline as well as top-bar. The source template still blocks inline outside this DEV inspection. The core remains version 2, presentation policy version 1: inline is review_required with no accepted entry point. No review approval, NOTICE_DEPLOYMENT_EVIDENCE or synthetic status is introduced.

The Commission guidance section 2.3 requires prominent display and default-size legibility; its placement examples are non-exhaustive. Presence at the document end is not, by itself, proof of prominence. Theme app embeds also do not establish checkout or confirmation-email coverage. Source: https://commission.europa.eu/document/download/3e4dbee6-8184-4256-923d-c52551c7e9f0_en

Pre-deployment checks: 57 extension tests, 5 packaging tests, lint and secret scan passed. The new render test verifies the native asset link and that inline remains absent outside the editor even with CONFIGURED or LIVE_VERIFIED and a saved preview checkbox. Official assets are unchanged.

Field review pending: home and product pages, desktop/mobile editor layouts, visibility after scrolling, modal and menu behavior. No physical-phone or real screen-reader result is implied.
