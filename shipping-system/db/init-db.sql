-- Create Schemas for Microservices Bounded Contexts
CREATE SCHEMA IF NOT EXISTS shipping_network_db;
CREATE SCHEMA IF NOT EXISTS shipping_pricing_db;
CREATE SCHEMA IF NOT EXISTS shipping_order_db;
CREATE SCHEMA IF NOT EXISTS shipping_courier_db;
CREATE SCHEMA IF NOT EXISTS shipping_tracking_db;

-- -----------------------------------------------------
-- 1. shipping_network_db Tables
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_network_db.ZONE (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_network_db.HUB (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES shipping_network_db.ZONE(id),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_network_db.ROUTE (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_zone_id UUID NOT NULL REFERENCES shipping_network_db.ZONE(id),
    dest_zone_id UUID NOT NULL REFERENCES shipping_network_db.ZONE(id),
    CONSTRAINT uq_route UNIQUE (origin_zone_id, dest_zone_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_network_db.DRIVER (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_enc VARCHAR(500) NOT NULL, -- PII Encrypted
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_network_db.TRUCK (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_network_db.LINEHAULTRIP (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_hub_id UUID NOT NULL REFERENCES shipping_network_db.HUB(id),
    dest_hub_id UUID NOT NULL REFERENCES shipping_network_db.HUB(id),
    driver_id UUID REFERENCES shipping_network_db.DRIVER(id),
    truck_id UUID REFERENCES shipping_network_db.TRUCK(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------
-- 2. shipping_pricing_db Tables
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_pricing_db.RATECARD (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_zone_id UUID NOT NULL, -- Logical FK to ZONE.id
    dest_zone_id UUID NOT NULL,   -- Logical FK to ZONE.id
    parcel_type VARCHAR(50) NOT NULL CHECK (parcel_type IN ('parcel', 'pallet')),
    price_cents INT NOT NULL,
    sla_days INT NOT NULL CHECK (sla_days > 0),
    effective_from TIMESTAMP NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ratecard_version UNIQUE (origin_zone_id, dest_zone_id, parcel_type, effective_from)
);

-- -----------------------------------------------------
-- 3. shipping_order_db Tables
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_order_db.CUSTOMER (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_enc VARCHAR(500) NOT NULL,    -- PII Encrypted
    phone_enc VARCHAR(500) NOT NULL,   -- PII Encrypted
    phone_hash VARCHAR(64) NOT NULL,   -- deterministic HMAC-SHA256(phone), for repeat-customer lookup only (phone_enc's random IV makes it unusable for equality lookups)
    address_enc VARCHAR(500) NOT NULL, -- PII Encrypted
    region_code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_order_db.SHIPMENT_ORDER (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES shipping_order_db.CUSTOMER(id),
    recipient_id UUID NOT NULL REFERENCES shipping_order_db.CUSTOMER(id),
    rate_card_id UUID NOT NULL, -- Logical FK to RATECARD.id
    price_cents INT NOT NULL,
    expected_delivery_at TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Draft', 'Created', 'Confirmed', 'Active', 'Complete', 'Partially_Delivered', 'Lost', 'Damaged', 'Cancelled')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_order_db.PARCEL (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_order_id UUID NOT NULL REFERENCES shipping_order_db.SHIPMENT_ORDER(id),
    route_id UUID, -- Logical FK to ROUTE.id
    declared_weight_grams INT NOT NULL CHECK (declared_weight_grams > 0),
    actual_weight_grams INT CHECK (actual_weight_grams > 0),
    type VARCHAR(50) NOT NULL CHECK (type IN ('parcel', 'pallet')),
    direction VARCHAR(50) NOT NULL CHECK (direction IN ('Forward', 'Reverse_RTS')),
    state VARCHAR(50) NOT NULL CHECK (state IN ('Created', 'InHub', 'InTransit', 'Misrouted', 'OutForDelivery', 'Delivered', 'Lost', 'Damaged')),
    sla_expected_delivery TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_order_db.PAYMENT (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_order_id UUID NOT NULL REFERENCES shipping_order_db.SHIPMENT_ORDER(id) UNIQUE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('PREPAID_STRIPE')),
    amount_cents INT NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Unpaid', 'Paid', 'Awaiting_Settlement')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_order_db.PAYMENT_TRANSACTION (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES shipping_order_db.PAYMENT(id),
    provider VARCHAR(50) NOT NULL, -- e.g. 'STRIPE', 'PAYPAL'
    external_transaction_id VARCHAR(255) UNIQUE NOT NULL,
    external_reference_id VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Transactional Outbox (Order Creation only, per docs/02-HLD.md § Idempotency
-- and outbox mechanics). Written in the same DB transaction as
-- SHIPMENT_ORDER/PARCEL; a background poller publishes PENDING rows to NATS
-- (Nats-Msg-Id = event_id) and marks them PUBLISHED.
CREATE TABLE IF NOT EXISTS shipping_order_db.OUTBOX (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP
);

-- -----------------------------------------------------
-- 4. shipping_courier_db Tables
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_courier_db.COURIER (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL, -- Logical FK to ZONE.id
    role VARCHAR(50) NOT NULL CHECK (role IN ('Courier', 'HubOperator', 'Dispatcher', 'Admin')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_courier_db.PROOF_OF_DELIVERY (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL,                 -- Logical FK to PARCEL.id
    signature_url VARCHAR(500),
    photo_url VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_courier_db.DELIVERY_ATTEMPT (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL, -- Logical FK to PARCEL.id
    -- BR-04: the attempt counter resets to zero after a 3rd-failure RTS, so
    -- the reverse leg reuses attempt_number 1-3 for the same parcel_id;
    -- direction (mirrors PARCEL.direction) scopes uq_parcel_attempt so the
    -- two legs' numbering never collides.
    direction VARCHAR(50) NOT NULL DEFAULT 'Forward' CHECK (direction IN ('Forward', 'Reverse_RTS')),
    attempt_number INT NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
    outcome VARCHAR(50) NOT NULL CHECK (outcome IN ('Failed', 'Succeeded')),
    failure_reason VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_parcel_attempt UNIQUE (parcel_id, direction, attempt_number)
);

-- -----------------------------------------------------
-- 5. shipping_tracking_db Tables
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_tracking_db.TRACKING_EVENT (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE, -- NATS event envelope id; consumer-side dedup (2nd idempotency layer)
    parcel_id UUID NOT NULL,       -- Logical FK to PARCEL.id
    hub_id UUID,                  -- Logical FK to HUB.id
    courier_id UUID,              -- Logical FK to COURIER.id
    linehaul_trip_id UUID,        -- Logical FK to LINEHAULTRIP.id
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('PICKUP', 'HUB_RECEIVE', 'DEPARTED_LINEHAUL', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED', 'DELIVERED', 'MISROUTED', 'RTS')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------
-- 6. Indexes for Physical & Logical Foreign Keys
-- -----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_hub_zone_id ON shipping_network_db.HUB(zone_id);

CREATE INDEX IF NOT EXISTS idx_linehaultrip_origin_hub_id ON shipping_network_db.LINEHAULTRIP(origin_hub_id);
CREATE INDEX IF NOT EXISTS idx_linehaultrip_dest_hub_id ON shipping_network_db.LINEHAULTRIP(dest_hub_id);
CREATE INDEX IF NOT EXISTS idx_linehaultrip_driver_id ON shipping_network_db.LINEHAULTRIP(driver_id);
CREATE INDEX IF NOT EXISTS idx_linehaultrip_truck_id ON shipping_network_db.LINEHAULTRIP(truck_id);

CREATE INDEX IF NOT EXISTS idx_ratecard_origin_dest_zone ON shipping_pricing_db.RATECARD(origin_zone_id, dest_zone_id);

CREATE INDEX IF NOT EXISTS idx_customer_phone_hash ON shipping_order_db.CUSTOMER(phone_hash);

CREATE INDEX IF NOT EXISTS idx_shipment_order_sender_id ON shipping_order_db.SHIPMENT_ORDER(sender_id);
CREATE INDEX IF NOT EXISTS idx_shipment_order_recipient_id ON shipping_order_db.SHIPMENT_ORDER(recipient_id);
CREATE INDEX IF NOT EXISTS idx_shipment_order_rate_card_id ON shipping_order_db.SHIPMENT_ORDER(rate_card_id);

CREATE INDEX IF NOT EXISTS idx_parcel_shipment_order_id ON shipping_order_db.PARCEL(shipment_order_id);
CREATE INDEX IF NOT EXISTS idx_parcel_route_id ON shipping_order_db.PARCEL(route_id);

CREATE INDEX IF NOT EXISTS idx_payment_transaction_payment_id ON shipping_order_db.PAYMENT_TRANSACTION(payment_id);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created_at ON shipping_order_db.OUTBOX(status, created_at) WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_courier_zone_id ON shipping_courier_db.COURIER(zone_id);

CREATE INDEX IF NOT EXISTS idx_proof_of_delivery_parcel_id ON shipping_courier_db.PROOF_OF_DELIVERY(parcel_id);

CREATE INDEX IF NOT EXISTS idx_delivery_attempt_parcel_id ON shipping_courier_db.DELIVERY_ATTEMPT(parcel_id);

CREATE INDEX IF NOT EXISTS idx_tracking_event_parcel_id ON shipping_tracking_db.TRACKING_EVENT(parcel_id);
CREATE INDEX IF NOT EXISTS idx_tracking_event_parcel_created ON shipping_tracking_db.TRACKING_EVENT(parcel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_event_hub_id ON shipping_tracking_db.TRACKING_EVENT(hub_id);
CREATE INDEX IF NOT EXISTS idx_tracking_event_courier_id ON shipping_tracking_db.TRACKING_EVENT(courier_id);
CREATE INDEX IF NOT EXISTS idx_tracking_event_linehaul_trip_id ON shipping_tracking_db.TRACKING_EVENT(linehaul_trip_id);
