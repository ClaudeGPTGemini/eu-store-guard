# Assisted approval and renewal candidate

Status: implemented and locally tested; not deployed, no operator key provisioned, no shop enabled by this delivery. The production guard and DEV shop allowlist remain unchanged.

## Authority and scope

A shop-owner session is necessary to submit an approval, but cannot create one. An operator signs a reviewed JSON record offline with Ed25519; the Worker only receives the corresponding public key. Neither the browser nor Shopify stores a signing private key. NOTICE_ASSISTED_REVIEW_ENABLED=true and NOTICE_REVIEW_SOURCE=app-metafield are required. The optional app control accepts the signed artifact and calls POST /app/accept-review with the existing authenticated owner session.

The operator must first inspect placement and record evidence under reviewId, retaining screenshots, routes, theme and limitations outside this current-baseline field. The record approves placement only (reviewScope=assisted-placement), never legal compliance, continuous visibility, physical-phone accessibility or a LIVE state. Preliminary placement review may precede the explicit owner save and subsequent canonical-storefront check; do not assert public verification from a preview.

## Signed record

Exactly: version=2, source=assisted-review, status=approved, reviewId, reviewerId, reviewedAt, expiresAt, shop, shopId, installationId, previousDigest, evidence. IDs are 8–100 ASCII alphanumeric/underscore/hyphen characters. Timestamps are canonical UTC ISO strings with milliseconds. evidence includes the same shop, header-section placement, sectionId, official asset details and exact themeRevision. Its reviewRecord equals reviewId; themeRevision.reviewedAt equals reviewedAt. previousDigest is null for first approval or the currently stored review compareDigest for renewal.

Proposed conservative product policy: explicitly selected expiry, no more than 30 days after review. This is not a legal requirement and not a promised review turnaround. Expiry is enforced on app access/save through existing checks; there is no scheduled revocation and no guarantee that an unattended storefront stops rendering at that exact time.

Offline command: node scripts/sign-notice-review.mjs review.json private-key.pem approval.json . The tool requires an existing Ed25519 key, never creates or prints one, and creates the output exclusively without overwriting. Keep keys and customer review artifacts outside the repository. Do not send a private key through chat or upload it to Shopify. Provisioning/custody/rotation of the real operator key remains an operational prerequisite; none was performed.

## Acceptance and renewal

Signature verification precedes any Shopify mutation. The signed domain, Shop ID, installation ID and previous digest must match. The actual published theme, timestamp and header hash are rechecked. Existing reviewId reuse is rejected. The exact signed payload, signature and verifying public key are retained as approvalProof for audit.

One CAS mutation writes review, NEEDS_INFORMATION, configuration and non-publicable presentation. Accepting an approval does not publish: the owner explicitly saves afterwards, when core checks and the actual theme are checked again. Renewal requires a new ID/signature/current digest, preventing replay. Conflicts are not retried or reported as success.

On a negative theme recheck, failure to obtain a trustworthy observation, or expiration detected on save/open, the assisted record is persistently marked review_required in the same CAS transaction that retracts publication. Restoring old header bytes and saving cannot revive it. This is a persisted renewal requirement, not a staffed support queue or automatic notification. Existing DEV migration records retain their legacy behavior for controlled transition.

## Operational gaps

Real signer provisioning, controlled DEV migration and runtime verification have not occurred. There is no customer onboarding rollout, immutable history service, scheduled verification, operator dashboard, notification/queue staffing, billing or approved privacy terms. The application remains restricted to its existing DEV shop. The latest baseline and its signature are retained; this does not preserve every superseded approval as an immutable ledger.

## Tests

Nine new Worker tests: first approval stays disabled then explicit save configures; tampering/unsigned/missing-key rejection; expiry/future/excess-duration rejection; shop/install/digest/theme binding; replay and renewal; remove/restore cannot revive; expiry retracts; atomic write conflicts; HTTP owner/origin/DEV/flag/signature boundaries and gated UI. Worker total 99, all pass locally. Lint and secret scan pass. CI build is the Linux packaging check; no live deployment was requested by this candidate.
