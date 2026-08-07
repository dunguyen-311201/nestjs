# Progress Report — Shipping System (2026-08-07)

Hi Duy and Hoang,

Here's an update on my NestJS learning, following our training plan.

## I. Finished

Fixed 3 of the 7 high-priority gaps from the review audit (day 1 of the 3-day extension), each with TDD and live-verification against the real dockerized stack (Postgres/Redis/NATS):

- **BR-04 delivery-attempt race condition**: per-`(parcel_id, direction)` Postgres advisory lock before computing the next attempt number. Verified with two genuinely concurrent transactions.
- **Dispatcher courier double-assign guard**: transactional guard rejecting assignment when the parcel is terminal or already has an outstanding assignment. Live testing caught a real flaw in the first version (checked an async-updated column) before landing on a correct fix, verified by reproducing the race, then confirming it's closed.
- **Notification redelivery dedup**: `IIdempotencyStore`/`RedisIdempotencyAdapter` (same pattern as Dispatcher/Courier/Line-haul) so a NATS redelivery no longer sends a duplicate customer email. Verified by publishing the same event twice and confirming only one real email sent.

Test suite: 451 → 462 passing across three commits; build/lint clean throughout.

## II. In Progress

Continuing through the remaining prioritized fixes with the same TDD + live-verification standard.

## III. Issues

None — on track to close out the rest of the high-priority list within the remaining extension days.

## IV. Next Plan

- Distinct completed state for returned (RTS) parcels.
- Idempotency-Key request body validation across services.
- Document the PII key-rotation limitation.
- Downstream request timeout at the API Gateway proxy.
- Confirm scope with Duy/Hoang before estimating the remaining medium/low-severity architecture gaps.

## V. Resources

- Specification & Analysis, Estimation, High Level Design: see `docs/`
- Source: `nodejs-training` repo, branch `feat/shipping-system`, folder `shipping-system`

Best regards,
Du Nguyen
