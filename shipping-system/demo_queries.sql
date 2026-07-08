-- QUERY 1: Full Parcel Tracking Timeline (UC-04 / Auditability)
-- retrieves the complete history of scan events for a specific parcel, ordered by time.

SELECT
    te.created_at,
    te.event_type,
    h.name AS hub_name,
    c.role AS courier_role,
    te.linehaul_trip_id
FROM shipping_tracking_db.TRACKING_EVENT te
LEFT JOIN shipping_network_db.HUB h ON te.hub_id = h.id
LEFT JOIN shipping_courier_db.COURIER c ON te.courier_id = c.id
WHERE te.parcel_id = (SELECT id FROM shipping_order_db.PARCEL LIMIT 1)
ORDER BY te.created_at ASC;


-- QUERY 2: Identify Misrouted Parcels (BR-02 / UC-12)
-- Finds parcels that were scanned at incorrect hubs, forcing a corrective re-route.

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
ORDER BY te.created_at DESC
LIMIT 5;

-- QUERY 3: SLA Violation / Passive Lost-Parcel Detection (UC-15)
-- Finds active in-transit parcels that breached their SLA target delivery date.

SELECT
    p.id AS parcel_id,
    p.sla_expected_delivery,
    te.event_type AS latest_scan_type,
    te.created_at AS latest_scan_time
FROM shipping_order_db.PARCEL p
JOIN (
    SELECT DISTINCT ON (parcel_id) parcel_id, event_type, created_at
    FROM shipping_tracking_db.TRACKING_EVENT
    ORDER BY parcel_id, created_at DESC
) te ON p.id = te.parcel_id
WHERE p.state NOT IN ('Delivered', 'Lost', 'Damaged')
  AND p.sla_expected_delivery < NOW()
ORDER BY p.sla_expected_delivery ASC
LIMIT 5;

-- QUERY 4: Revenue and Volume by Zone Pairs (Pricing Analytics)
-- Aggregates shipment volume, total revenue, and average prices by zone corridors.

SELECT
    z_origin.region_code AS origin_zone,
    z_dest.region_code AS dest_zone,
    COUNT(o.id) AS order_count,
    SUM(o.price_cents) / 100.0 AS total_revenue_usd,
    AVG(o.price_cents) / 100.0 AS avg_order_price_usd
FROM shipping_order_db.SHIPMENT_ORDER o
JOIN shipping_pricing_db.RATECARD rc ON o.rate_card_id = rc.id
JOIN shipping_network_db.ZONE z_origin ON rc.origin_zone_id = z_origin.id
JOIN shipping_network_db.ZONE z_dest ON rc.dest_zone_id = z_dest.id
GROUP BY z_origin.region_code, z_dest.region_code
ORDER BY order_count DESC
LIMIT 5;

-- QUERY 5: Return-to-Sender (RTS) Tracking (BR-04 / UC-13)
-- Lists parcels traveling in the Reverse direction due to 3 failed attempts.

SELECT
    p.id AS parcel_id,
    p.direction,
    p.state AS current_state,
    (
        SELECT COUNT(*)
        FROM shipping_courier_db.DELIVERY_ATTEMPT
        WHERE parcel_id = p.id
    ) AS failed_attempt_count
FROM shipping_order_db.PARCEL p
WHERE p.direction = 'Reverse_RTS'
ORDER BY failed_attempt_count DESC
LIMIT 5;


