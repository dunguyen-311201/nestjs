# Edge-Case Audit — 2026-08-06

Post-break review: audited all major use cases across the system (Order/Payment, Courier, Dispatcher, Line-haul, Hub, Notification, Tracking, API Gateway, PII encryption) for gaps between documented behavior and actual code — specifically cases beyond the happy path (races, retries/idempotency, infra failures, stale/rotated keys, out-of-order events). Two gaps found this same day were already fixed and are not repeated here: abandoned Stripe checkout never auto-cancelling the order, and the `Damaged` parcel state having zero trigger path.

Each finding below was verified by reading the actual code (file:line), not inferred from docs alone.

## High severity — can cause silent wrong data/behavior

1. **Delivery-attempt race condition (BR-04)** — `apps/courier/src/repositories/courier.repository.ts:64-91`. `recordDeliveryFailure` does `SELECT MAX(attempt_number)` then `INSERT` with no row lock and no unique constraint on `(parcel_id, direction, attempt_number)`. Two near-simultaneous `DELIVERY_FAILED` events for the same parcel can both read the same latest count and insert a duplicate attempt number — RTS may never trigger at exactly 3, or trigger twice.
2. **Dispatcher parcel-assign has no state/conflict guard** — `apps/dispatcher/src/dispatcher.service.ts:83-133`. `assignLeg` never checks the parcel's current state (e.g. already terminal) or whether it's already assigned to a courier. Two concurrent assign calls (different idempotency keys) both pass validation and both publish `parcel.out_for_delivery` — with two different couriers.
3. **Notification has no redelivery dedup** — `apps/notification/src/notification.service.ts` / `notification.consumer.ts`. Unlike Dispatcher/Line-haul (which both use `IIdempotencyStore` keyed on event id), Notification's `sendNotification` calls the email provider directly with no dedup check. A NATS redelivery of `order.created` sends a duplicate customer email.
4. **No terminal state for a completed RTS leg** — `apps/order/src/domain/parcel-state-machine.ts`. After `applyRts`, a parcel re-enters the normal forward transitions and can reach plain `DELIVERED` — indistinguishable from a normal delivery to the original recipient. `SHIPMENT_ORDER.status` then projects to `Complete` even though the parcel was actually returned to sender.
5. **Idempotency-Key doesn't validate request body** — e.g. `apps/courier/src/courier.service.ts:59-95`. Cache key is the header string alone; a retried request with the same key but a different body silently returns the stale cached result instead of a 409/422.
6. **PII key rotation unsupported and undocumented** — `libs/crypto/src/pii-crypto.ts`. `getKey()` reads a single env-var key with no key ID/version stored alongside ciphertext. Rotating the key makes all previously-encrypted rows permanently undecryptable, and this isn't flagged anywhere as a known limitation.
7. **Gateway has no downstream request timeout** — `apps/api-gateway/src/proxy.service.ts:64-83` (`forward`). `http.request` has no `.setTimeout()`/`timeout` option — only connection-refused is handled (502). If a downstream service accepts the connection and never responds, the client request hangs indefinitely, leaking a socket per stalled request.

## Medium severity — design/architecture gaps, not silent corruption

8. **Outbox pollers don't claim rows before publishing** — repeated across Order/Hub/Courier/Dispatcher/Line-haul pollers, e.g. `apps/order/src/repositories/outbox.repository.ts:13-19`. `findPendingBatch` is a plain `find({status: PENDING})` with no `FOR UPDATE SKIP LOCKED`. Running more than one instance of a service risks double-publishing the same row.
9. **BR-02 "corrective re-route" has no real re-routing logic** — no consumer of `PARCEL_MISROUTED` exists in Dispatcher or Line-haul. A misrouted parcel only resumes via the same scan events used on the happy path; the "corrective re-route" language in the BR overstates what's implemented.
10. **BR-06 weight-mismatch reconciliation is 100% doc-only** — `docs/02-HLD.md:233` claims discrepancy audit + deferred adjustment billing; grepping the whole codebase for weight-discrepancy/audit logic returns zero matches. No entity, field, or service implements it.
11. **Notification never emails the real customer** — `ResendEmailAdapter`/`SendGridEmailAdapter` send to a static `RESEND_TO_EMAIL`/`SENDGRID_TO_EMAIL` env var, not any address from the event payload (none of the event contracts even carry a customer email field).
12. **Auth failures collapse network errors and invalid tokens into the same 401** — `apps/api-gateway/src/auth/clerk-auth.guard.ts:50-55`. A Clerk API outage and an actually-invalid/expired token both throw the same generic 401, misleading monitoring/clients about the real cause.
13. **Dispatcher trip-assign has no terminal-trip guard** — `apps/dispatcher/src/dispatcher.service.ts:33-81`. `assignTrip` checks driver/truck double-booking but not whether the trip itself is already departed/arrived/completed before assigning driver+truck to it.

## Low severity / test-coverage gaps

14. **`markDamaged` allowed from `Created`** — `apps/order/src/domain/parcel-state-machine.ts:136-150`. Inconsistent with `markLostSuspected`, which explicitly excludes `Created` with a documented reason; damage is supposed to be discovered during a scan, implying the parcel should already be in-network.
15. **No test for gateway RBAC's documented "first match wins" rule** — `apps/api-gateway/src/route-access.config.ts:9-20`. The comment states first-match-wins semantics, but no current route overlaps another, so the claim is unverified by any test — a latent gap for future route additions.

## Next steps

- Prioritize #1–#7 (high severity) for TDD fixes.
- Confirm scope with Supporter/Mentor before touching #8–#10 (Outbox multi-instance claiming, corrective re-route, weight reconciliation) — these are design decisions, not simple fixes.
- Document each fix with a clear before/after.
