# Authorization Plan — Role-Based Access (3-day estimation)

## Goal

Every main actor can authenticate (Clerk) and use the system within their role:

| Actor | Journey to enable |
| :--- | :--- |
| **Customer** | Sign up / sign in → place order → track own orders → receive email notifications |
| **Shipper** (courier) | Sign in → accept & complete pickup legs → complete delivery legs |
| **Hub staff** | Sign in → warehouse operations: receive/scan/dispatch parcels at the hub |
| **Dispatcher** | Sign in → assign trips and legs |
| **Admin** | Everything; sees all orders |

Authentication already exists (ClerkAuthGuard at the gateway, session JWT,
`x-user-id`/`x-session-id` propagation). This plan adds **authorization**.

## Design

- **Role storage:** Clerk `publicMetadata.role` (one of `customer`, `shipper`,
  `hub_staff`, `dispatcher`, `admin`). Embedded in the session JWT via Clerk
  Dashboard → Sessions → Customize session token:
  `{ "role": "{{user.public_metadata.role}}" }`.
  A user may hold multiple roles later; slice assumes one role per user.
- **Enforcement point:** the API gateway. `ROUTE_ACCESS` map
  (method + path pattern → allowed roles), same shape as `PROXY_ROUTES` /
  `PUBLIC_ROUTES`. Missing/invalid token → 401; valid token, insufficient
  role → 403.
- **Propagation:** `buildForwardHeaders` injects `x-user-role` (client-sent
  value stripped unconditionally, same as `x-user-id`).
- **Ownership (customer):** `SHIPMENT_ORDER` gains `created_by_user_id`
  (nullable — legacy orders have no owner and are admin-visible only).
  Order service writes it from `x-user-id` on create and filters
  `GET /orders` by it unless `x-user-role: admin`.
- **Notifications:** recipient email resolved from the Clerk user (via the
  order's stored contact email captured at creation from the authenticated
  user), keeping the Notification consumer stateless.

## Permission matrix (initial)

| Route | customer | shipper | hub_staff | dispatcher | admin |
| :--- | :-: | :-: | :-: | :-: | :-: |
| `POST /orders`, `GET /orders` (own) | ✅ | | | | ✅ (all) |
| `/payments/*` (except webhook) | ✅ | | | | ✅ |
| `GET /tracking/*` (own order) | ✅ | | | | ✅ |
| `/couriers/*`, `POST /legs/:id/pickup|deliver` | | ✅ | | | ✅ |
| `/hubs/*` | | | ✅ | | ✅ |
| `/trips/*` | | | | ✅ | ✅ |
| `/legs/:id/assign`, `/trips/:id/assign` | | | | ✅ | ✅ |
| `POST /payments/webhook`, `/health`, docs | public (unchanged) | | | | |

## 3-day plan

**Day 1 — Role in the token (~1d)**
1. `Role` type in `libs/contracts`; extend `VerifiedToken` with `role`;
   `ClerkTokenVerifier` reads the claim (TDD).
2. Clerk Dashboard: session token customization; create one test user per
   role (script via Backend API or manual).
3. Web app token panel shows the decoded role.

**Day 2 — Gateway RBAC (~1d)**
1. `ROUTE_ACCESS` map + role check in `ClerkAuthGuard` (TDD: each role ×
   route group, 401 vs 403 distinction).
2. `x-user-role` injection + strip in `buildForwardHeaders` (TDD).
3. Smoke test with real per-role tokens.

**Day 3 — Customer ownership + end-to-end (~1d)**
1. Migration: `SHIPMENT_ORDER.created_by_user_id` (nullable); order service
   writes it on create, filters `GET /orders` (TDD).
2. Tracking lookup restricted to own orders for customers.
3. E2E smoke per actor journey (customer order→track→email; shipper
   pickup→deliver; hub receive; dispatcher assign; admin sees all).
4. Docs sync (LLD gateway + order; `09-real-integrations-guide.md`) + TASKS.

## Verdict: fits in 3 days ✅ (with these cuts)

**Out of scope (do NOT slip in):**
- Per-resource ownership for shipper/hub/dispatcher (e.g. shipper sees only
  legs assigned to them) — needs assignee columns + joins, ~1.5–2d extra.
  The shipper half is now planned as Phase 10 in
  [03-phases.md](./03-phases.md) (2.0d); hub/dispatcher ownership stays cut.
- Admin UI for role management (roles assigned via Clerk Dashboard).
- Clerk→DB user sync webhooks.
- Multi-role users.

**Risks:**
1. Legacy orders have no owner → decision locked: nullable column, old
   orders admin-only. No backfill.
2. First-time Clerk session-claim setup can eat debugging time (budgeted in
   Day 1).
3. Tracking-by-barcode is currently orderless — restricting it to owners
   requires a barcode→order lookup; if it drags, fallback is leaving
   tracking readable to any authenticated customer (flag in review).
