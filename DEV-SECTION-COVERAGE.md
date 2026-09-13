# DEV section notice: Horizon placement and coverage

Date: 2026-09-13. Source commit: `215fa535444e038600455d8ea9e247238e4a6f16`.
Shopify DEV version: `eu-store-guard-dev-10`, ID `1127130333185`.
Theme: Horizon draft `159264309480`. Published DEV theme was not changed.

## Implementation and boundaries

The DEV packager derives an independent `target: section` block from the existing notice. Its position is normal-flow `inline`; it neither moves DOM nodes nor changes body/header CSS. This block is not added to the canonical extension source. It is always closed outside the exact DEV shop's opted-in theme editor, including when the core state is CONFIGURED or LIVE. The real state is preserved, not fabricated. No core rule, Worker, secret, scope or activation classifier changed.

Six packaging tests pass locally, including real Liquid rendering of the section candidate and negative cases for public requests, other shops, unsupported locale and disabled preview. Lint and secret scan pass. GitHub CI, Theme Extension and DEV upload all succeeded on the source commit. The upload validates 57 extension tests and all 26 official asset hashes.

## Actual insertion

In Horizon, Header group > Add section > Apps offered `Aviso sección DEV`. Selecting it successfully created an independent Section below the native Header and before the template content. No theme source edit was needed. This is a tested header-GROUP insertion, not an app block inside the native Header section.

Saved section identifier: `sections--22066757075176__1789330139cc04988b`.
Saved block suffix: `eu_store_guard_dev_guarantee_notice_section_dev_XzMMUU`.

## Coverage observed in Shopify's theme editor

Only one insertion was made. The editor's page selector changed the preview page; no blocks were added to individual templates.

| Page | Tested path | Result |
| --- | --- | --- |
| Home | `/` | Notice link below header, before hero |
| Product | `/products/gift-card` | Same section before product content |
| Collection | `/collections/automated-collection` | Same section before collection heading |
| Cart | `/cart` | Same section before empty-cart content |
| Search | `/search` | Same section before search heading/form |

Accessibility-tree observations placed the notice inside `header-group` before `MainContent`; screenshots confirmed the visible initial position in all five desktop previews. Menu, search and cart header controls were not covered by the notice. This verifies these five previews, not every route, alternate template, checkout, account page or other theme.

## Mobile presentation sample

On Search, the editor's mobile preview showed the entry without horizontal clipping below the header. One click opened the dialog with visible close control; focus entered its heading and Escape returned it to the originating notice link. The mobile theme menu opened with Home/Catalog/Contact visible and closed with Escape. The official image remains small; the existing full-size link and Spanish transcription remain available.

This was an editor viewport and accessibility-tree inspection, not a physical phone or screen-reader session. Mobile coverage was not repeated on every template. The inspection banner occupies extra space and is not final customer presentation.

## Conclusion and remaining work

The claim that a section block can only cover the home page is disproven for this installed Horizon theme: one header-group placement covered the five requested pages. This is a viable candidate, not universal compatibility or certified prominence. Production logic, presentation-policy acceptance, onboarding and activation observation still need deliberate integration before customer publication. No LIVE state or public certification was assigned.

The section remains in the Horizon draft for reproducibility; its DEV preview switch is turned off after inspection. Horizon remains unpublished, the public DEV theme is unchanged, PR #3 is unmerged and spending remains EUR 0.
