-- ============================================================================
-- SHIPPING SYSTEM ANALYTICAL QUERY SUITE
--
-- This script contains the SQL queries corresponding to the analytical requirements.
-- You can run these queries directly in the PostgreSQL database using:
--   docker exec -it shipping_postgres psql -U postgres -d postgres -f queries.sql
--
-- NOTE: these queries join directly across shipping_order_db / shipping_tracking_db /
-- shipping_network_db / shipping_courier_db / shipping_pricing_db schemas because they
-- run offline, for reporting/audit, against the single physical Postgres instance used
-- in this training project. The live microservices themselves never do this — each
-- service only reads/writes its own schema at runtime and gets cross-service data via
-- NATS events (see CLAUDE.md: "Cross-service references: plain IDs, NOT foreign keys").
-- ============================================================================

-- ----------------------------------------------------------------------------
-- QUERY 1: Full Parcel Tracking Timeline (UC-04 / Auditability)
-- Retrieves the complete history of scan events for a specific parcel, ordered by time.
-- Replace the subquery with a real parcel_id when using this for a specific lookup.
-- ----------------------------------------------------------------------------
\echo '--- QUERY 1: Full Parcel Tracking Timeline for a specific parcel ---'
SELECT
    te.created_at,
    te.event_type,
    h.name AS hub_name,
    c.role AS courier_role,
    lh_origin.name AS linehaul_origin_hub,
    lh_dest.name AS linehaul_dest_hub
FROM shipping_tracking_db.TRACKING_EVENT te
LEFT JOIN shipping_network_db.HUB h ON te.hub_id = h.id
LEFT JOIN shipping_courier_db.COURIER c ON te.courier_id = c.id
LEFT JOIN shipping_network_db.LINEHAULTRIP lh ON te.linehaul_trip_id = lh.id
LEFT JOIN shipping_network_db.HUB lh_origin ON lh.origin_hub_id = lh_origin.id
LEFT JOIN shipping_network_db.HUB lh_dest ON lh.dest_hub_id = lh_dest.id
WHERE te.parcel_id = (SELECT id FROM shipping_order_db.PARCEL ORDER BY created_at ASC LIMIT 1) -- REPLACE with actual parcel_id
ORDER BY te.created_at ASC;


-- ----------------------------------------------------------------------------
-- QUERY 1b: Order-Level Aggregated Tracking Timeline (UC-04)
-- UC-04 is defined as "aggregated scan timeline across ALL parcels in the order",
-- not a single parcel — Query 1 only covers the single-parcel case. This variant
-- merges every parcel belonging to one shipment order into one ordered timeline.
-- Replace the subquery with a real shipment_order_id.
-- ----------------------------------------------------------------------------
\echo '--- QUERY 1b: Aggregated tracking timeline for all parcels in an order ---'
SELECT
    p.id AS parcel_id,
    te.created_at,
    te.event_type,
    h.name AS hub_name,
    c.role AS courier_role
FROM shipping_order_db.PARCEL p
JOIN shipping_tracking_db.TRACKING_EVENT te ON te.parcel_id = p.id
LEFT JOIN shipping_network_db.HUB h ON te.hub_id = h.id
LEFT JOIN shipping_courier_db.COURIER c ON te.courier_id = c.id
WHERE p.shipment_order_id = (SELECT id FROM shipping_order_db.SHIPMENT_ORDER ORDER BY created_at ASC LIMIT 1) -- REPLACE with actual shipment_order_id
ORDER BY te.created_at ASC;


-- ----------------------------------------------------------------------------
-- QUERY 2: Identify Misrouted Parcels (BR-02 / UC-12)
-- Finds parcels that were scanned at incorrect hubs, forcing a corrective re-route.
-- No LIMIT: this is an exception-monitoring query, not a top-N report — capping it
-- would hide unresolved misrouted parcels from ops.
-- ----------------------------------------------------------------------------
\echo '--- QUERY 2: Identify Misrouted Parcels ---'
SELECT
    te.parcel_id,
    te.created_at AS misrouted_at,
    h.name AS misrouted_at_hub,
    p.direction,
    p.state AS current_state
FROM shipping_tracking_db.TRACKING_EVENT te
JOIN shipping_network_db.HUB h ON te.hub_id = h.id
JOIN shipping_order_db.PARCEL p ON te.parcel_id = p.id
WHERE te.event_type = 'MISROUTED'
ORDER BY te.created_at DESC;


-- ----------------------------------------------------------------------------
-- QUERY 3: SLA Violation / Passive Lost-Parcel Detection (UC-15)
-- Finds parcels that breached their SLA target delivery date and have not reached
-- a terminal state. Uses a LEFT JOIN (not JOIN) on the latest scan event so parcels
-- with ZERO tracking events (e.g. never picked up after Confirmed) still surface —
-- an inner join would silently drop exactly the worst "lost" case. No LIMIT, for the
-- same reason as Query 2: this must catch every breach, not the top 5.
-- ----------------------------------------------------------------------------
\echo '--- QUERY 3: SLA Violation / Passive Lost-Parcel Candidates ---'
SELECT
    p.id AS parcel_id,
    p.sla_expected_delivery,
    te.event_type AS latest_scan_type,
    te.created_at AS latest_scan_time
FROM shipping_order_db.PARCEL p
LEFT JOIN (
    SELECT DISTINCT ON (parcel_id) parcel_id, event_type, created_at
    FROM shipping_tracking_db.TRACKING_EVENT
    ORDER BY parcel_id, created_at DESC
) te ON p.id = te.parcel_id
WHERE p.state NOT IN ('Delivered', 'Lost', 'Damaged')
  AND p.sla_expected_delivery < NOW()
ORDER BY p.sla_expected_delivery ASC;


-- ----------------------------------------------------------------------------
-- QUERY 4: Revenue and Volume by Zone Pairs (Pricing Analytics)
-- Aggregates shipment volume, total revenue, and average prices by zone corridors.
-- Excludes Draft (price/ETA not yet locked) and Cancelled orders so revenue isn't
-- overstated with orders that were never actually fulfilled/paid for.
-- Column names no longer assume USD: price_cents is a generic minor-unit integer
-- per CLAUDE.md conventions, currency is not specified as USD elsewhere in the docs.
-- ----------------------------------------------------------------------------
\echo '--- QUERY 4: Top 5 corridors by revenue and volume ---'
SELECT
    z_origin.region_code AS origin_zone,
    z_dest.region_code AS dest_zone,
    COUNT(o.id) AS order_count,
    SUM(o.price_cents) / 100.0 AS total_revenue_major_units,
    AVG(o.price_cents) / 100.0 AS avg_order_price_major_units
FROM shipping_order_db.SHIPMENT_ORDER o
JOIN shipping_pricing_db.RATECARD rc ON o.rate_card_id = rc.id
JOIN shipping_network_db.ZONE z_origin ON rc.origin_zone_id = z_origin.id
JOIN shipping_network_db.ZONE z_dest ON rc.dest_zone_id = z_dest.id
WHERE o.status NOT IN ('Draft', 'Cancelled')
GROUP BY z_origin.region_code, z_dest.region_code
ORDER BY order_count DESC
LIMIT 5;


-- ----------------------------------------------------------------------------
-- QUERY 5: Return-to-Sender (RTS) Tracking (BR-04 / UC-13)
-- Lists parcels traveling in the Reverse direction due to 3 failed attempts.
-- Only counts outcome = 'Failed' attempts — counting every DELIVERY_ATTEMPT row
-- regardless of outcome would fold a Succeeded attempt into a column literally
-- named failed_attempt_count.
-- No LIMIT: this is an exception-monitoring query like Query 2/3, not a top-N
-- report — capping it would hide unresolved RTS parcels from ops (a prior
-- version had LIMIT 5 here, silently dropping most of the real RTS backlog).
--
-- KNOWN LIMITATION (flagging, not fixing here): DELIVERY_ATTEMPT has
-- UNIQUE(parcel_id, attempt_number) with attempt_number CHECK 1-3.
-- docs/lld/courier-service.md:14 says attempt_number "restarts at 1" on the
-- reverse leg, but that would collide with the forward leg's attempt_number=1
-- under this constraint — there's no leg discriminator column to disambiguate
-- forward vs. reverse attempts. This query can only report the combined total;
-- it cannot isolate reverse-leg-only failures until the schema adds something
-- like a `leg` column and widens the unique constraint to (parcel_id, leg, attempt_number).
-- ----------------------------------------------------------------------------
\echo '--- QUERY 5: Return-to-Sender (RTS) tracking ---'
SELECT
    p.id AS parcel_id,
    p.direction,
    p.state AS current_state,
    (
        SELECT COUNT(*)
        FROM shipping_courier_db.DELIVERY_ATTEMPT
        WHERE parcel_id = p.id
          AND outcome = 'Failed'
    ) AS failed_attempt_count
FROM shipping_order_db.PARCEL p
WHERE p.direction = 'Reverse_RTS'
ORDER BY failed_attempt_count DESC;


-- ----------------------------------------------------------------------------
-- QUERY 6a: Current Rate-Card Unit Price for a Zone Corridor (BR-01 / UC-01)
-- Looks up the currently-effective RATECARD price for a given origin/dest
-- zone (by region_code) and parcel type. This is the "list price" for the
-- corridor right now — not tied to any specific order. RateCard versioning
-- (append-only, effective_from/effective_to) is still an open decision per
-- CLAUDE.md, but the columns exist in the schema, so we filter on them here.
-- ----------------------------------------------------------------------------
\echo '--- QUERY 6a: Current unit price from zone A to zone B ---'
SELECT
    rc.id AS rate_card_id,
    z_origin.region_code AS origin_zone,
    z_dest.region_code AS dest_zone,
    rc.parcel_type,
    rc.price_cents,
    rc.effective_from,
    rc.effective_to
FROM shipping_pricing_db.RATECARD rc
JOIN shipping_network_db.ZONE z_origin ON rc.origin_zone_id = z_origin.id
JOIN shipping_network_db.ZONE z_dest ON rc.dest_zone_id = z_dest.id
WHERE z_origin.region_code = 'A'          -- replace 'A' with the origin region_code
  AND z_dest.region_code = 'B'            -- replace 'B' with the destination region_code
  AND rc.parcel_type = 'parcel'           -- or 'pallet'
  AND rc.effective_from <= NOW()
  AND (rc.effective_to IS NULL OR rc.effective_to > NOW())
ORDER BY rc.effective_from DESC
LIMIT 1;


-- ----------------------------------------------------------------------------
-- QUERY 6b: Locked Price of an Existing Order by Sender/Recipient Region (UC-01)
-- SHIPMENT_ORDER.price_cents is locked at creation (BR-01) and does not move
-- with later RATECARD changes; use this when asking "what did this specific
-- order from A to B actually cost", as opposed to 6a's current list price.
-- ----------------------------------------------------------------------------
\echo '--- QUERY 6b: Locked order price by sender/recipient region ---'
SELECT
    o.id AS order_id,
    sender.region_code AS origin_region,
    recipient.region_code AS dest_region,
    o.price_cents,
    o.status,
    o.created_at
FROM shipping_order_db.SHIPMENT_ORDER o
JOIN shipping_order_db.CUSTOMER sender ON o.sender_id = sender.id
JOIN shipping_order_db.CUSTOMER recipient ON o.recipient_id = recipient.id
WHERE sender.region_code = 'A'             -- replace 'A' with the origin region_code
  AND recipient.region_code = 'B'          -- replace 'B' with the destination region_code
ORDER BY o.created_at DESC
LIMIT 5;


-- ----------------------------------------------------------------------------
-- QUERY 7: BR-08 Payment-Gate Violation Check (Order/Courier boundary)
-- BR-08 says no pickup or hub-inbound scan may be accepted before
-- SHIPMENT_ORDER.status = Confirmed. This audits for violations: any PICKUP or
-- HUB_RECEIVE scan recorded before the order's payment was actually confirmed.
--
-- Compares against PAYMENT_TRANSACTION.created_at (the moment the webhook
-- confirmed payment and flipped ORDER.status to Confirmed — see
-- docs/lld/order-service.md "Side effect" on POST /payments/webhook), not
-- SHIPMENT_ORDER.status. Status is mutable and reflects only the CURRENT
-- state: a prior version of this query checked `o.status IN ('Draft',
-- 'Created')`, so a real violation silently vanished from the audit the
-- moment the order later progressed past those statuses — exactly the
-- historical case this query exists to catch.
-- A healthy system should always return zero rows.
-- ----------------------------------------------------------------------------
\echo '--- QUERY 7: BR-08 violations (scans before payment confirmed) ---'
SELECT
    te.id AS tracking_event_id,
    te.parcel_id,
    te.event_type,
    te.created_at AS scan_at,
    o.id AS order_id,
    o.status AS order_status_now,
    pt.confirmed_at AS payment_confirmed_at
FROM shipping_tracking_db.TRACKING_EVENT te
JOIN shipping_order_db.PARCEL p ON te.parcel_id = p.id
JOIN shipping_order_db.SHIPMENT_ORDER o ON p.shipment_order_id = o.id
JOIN shipping_order_db.PAYMENT pay ON pay.shipment_order_id = o.id
LEFT JOIN LATERAL (
    SELECT MIN(created_at) AS confirmed_at
    FROM shipping_order_db.PAYMENT_TRANSACTION
    WHERE payment_id = pay.id
) pt ON true
WHERE te.event_type IN ('PICKUP', 'HUB_RECEIVE')
  AND (pt.confirmed_at IS NULL OR te.created_at < pt.confirmed_at)
ORDER BY te.created_at DESC;


-- ----------------------------------------------------------------------------
-- QUERY 8: BR-06 Weight Discrepancy Reconciliation Candidates
-- Finds parcels whose hub-measured weight differs from the sender-declared
-- weight — flagged for the post-delivery invoice/adjustment BR-06 defers to.
-- ----------------------------------------------------------------------------
\echo '--- QUERY 8: Weight discrepancies pending reconciliation ---'
SELECT
    p.id AS parcel_id,
    p.declared_weight_grams,
    p.actual_weight_grams,
    (p.actual_weight_grams - p.declared_weight_grams) AS delta_grams,
    p.state AS current_state
FROM shipping_order_db.PARCEL p
WHERE p.actual_weight_grams IS NOT NULL
  AND p.actual_weight_grams <> p.declared_weight_grams
ORDER BY ABS(p.actual_weight_grams - p.declared_weight_grams) DESC;


-- ----------------------------------------------------------------------------
-- QUERY 9: Proof-of-Delivery Completeness Check (UC-06 data integrity)
-- docs/lld/courier-service.md requires signature_url whenever outcome=DELIVERED.
-- Finds DELIVERED scan events with no PROOF_OF_DELIVERY row at all, or a POD row
-- missing signature_url — both indicate incomplete delivery evidence.
-- A healthy system should always return zero rows.
--
-- Joins on parcel_id, not a tracking_event_id FK: Courier writes PROOF_OF_DELIVERY
-- synchronously in its own request handler, before Tracking has even consumed the
-- parcel.delivered event and appended this DELIVERED row (different service, async,
-- cross-schema) — there is no tracking_event_id Courier could have written at POD
-- creation time. parcel_id is safe as the join key because BR-04 allows at most one
-- true DELIVERED event per parcel in this scoped slice (see docs/01-ERD.md note).
-- ----------------------------------------------------------------------------
\echo '--- QUERY 9: DELIVERED events missing proof of delivery ---'
SELECT
    te.id AS tracking_event_id,
    te.parcel_id,
    te.created_at AS delivered_at,
    pod.id AS proof_of_delivery_id,
    pod.signature_url
FROM shipping_tracking_db.TRACKING_EVENT te
LEFT JOIN shipping_courier_db.PROOF_OF_DELIVERY pod ON pod.parcel_id = te.parcel_id
WHERE te.event_type = 'DELIVERED'
  AND (pod.id IS NULL OR pod.signature_url IS NULL)
ORDER BY te.created_at DESC;
