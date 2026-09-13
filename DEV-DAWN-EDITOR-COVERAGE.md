# Dawn initial editor coverage — DEV, 2026-09-13

Dawn was installed from the official Shopify Theme Store as a free draft, theme ID `159296487656`. Horizon remains the active, password-protected DEV theme. No app scope, server presentation binding, credential or production setting was changed for this test.

The editor offered the real Header block and the DEV inspection block in the Header group. The inspection block was added once, in section `sections--22076885434600__178933329392edae07`, with its explicitly labelled editor-only preview enabled. This tests group propagation and component presentation, not the real configuration flow in Dawn. The server remains bound to the reviewed Horizon section.

| Editor route | Notice present from the same Header group |
| --- | --- |
| Home | yes |
| `/products/gift-card` | yes |
| `/collections/automated-collection` | yes |
| `/cart` | yes |
| `/search` (query gift) | yes |

The collection editor stalled during navigation and recovered after one reload. The rendered accessibility tree placed the notice between the theme header and main content on the observed collection, cart and search views. Home and mobile Search were inspected visually. Dawn's Header setting was `On scroll up`; it was not changed.

On mobile Search in Shopify's editor, the access link was visible beneath the header without overlap. One click opened the dialog within the preview viewport, with a visible close button and initial focus on the heading. Escape closed it and returned focus to the link. This is neither a physical-phone nor a real-screen-reader test. The mobile preview was switched off afterwards.

Cleanup: the editor-only preview was switched off and saved. A reload confirmed the switch remained off, Save was disabled and the notice link was absent. A slow editor update required recovery, but the final persisted state was verified. Dawn remains a draft.

This evidence does not approve Dawn for a customer launch: the real configuration-to-storefront path, broader template coverage and final prominence/accessibility review remain pending. The successful real Horizon flow is recorded separately in `DEV-HEADER-REAL-FLOW.md`. PR #3 remains unmerged; expenditure EUR 0.
