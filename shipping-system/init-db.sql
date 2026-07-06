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
    id UUID PRIMARY KEY,
    region_code VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS shipping_network_db.HUB (
    id UUID PRIMARY KEY,
    zone_id UUID NOT NULL REFERENCES shipping_network_db.ZONE(id),
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS shipping_network_db.ROUTE (
    id UUID PRIMARY KEY,
    origin_zone_id UUID NOT NULL REFERENCES shipping_network_db.ZONE(id),
    dest_zone_id UUID NOT NULL REFERENCES shipping_network_db.ZONE(id),
    CONSTRAINT uq_route UNIQUE (origin_zone_id, dest_zone_id)
);

CREATE TABLE IF NOT EXISTS shipping_network_db.DRIVER (
    id UUID PRIMARY KEY,
    name_enc VARCHAR(500) NOT NULL -- PII Encrypted
);

CREATE TABLE IF NOT EXISTS shipping_network_db.TRUCK (
    id UUID PRIMARY KEY,
    plate VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS shipping_network_db.LINEHAULTRIP (
    id UUID PRIMARY KEY,
    origin_hub_id UUID NOT NULL, -- Logical FK to HUB.id
    dest_hub_id UUID NOT NULL,   -- Logical FK to HUB.id
    driver_id UUID,              -- Logical FK to DRIVER.id
    truck_id UUID                -- Logical FK to TRUCK.id
);

-- -----------------------------------------------------
-- 2. shipping_pricing_db Tables
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_pricing_db.RATECARD (
    id UUID PRIMARY KEY,
    origin_zone_id UUID NOT NULL, -- Logical FK to ZONE.id
    dest_zone_id UUID NOT NULL,   -- Logical FK to ZONE.id
    parcel_type VARCHAR(50) NOT NULL CHECK (parcel_type IN ('parcel', 'pallet')),
    price_cents INT NOT NULL
);

-- -----------------------------------------------------
-- 3. shipping_order_db Tables
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_order_db.CUSTOMER (
    id UUID PRIMARY KEY,
    name_enc VARCHAR(500) NOT NULL,    -- PII Encrypted
    phone_enc VARCHAR(500) NOT NULL,   -- PII Encrypted
    address_enc VARCHAR(500) NOT NULL, -- PII Encrypted
    region_code VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS shipping_order_db.ORDER (
    id UUID PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES shipping_order_db.CUSTOMER(id),
    recipient_id UUID NOT NULL REFERENCES shipping_order_db.CUSTOMER(id),
    rate_card_id UUID NOT NULL, -- Logical FK to RATECARD.id
    price_cents INT NOT NULL,
    expected_delivery_at TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Draft', 'Created', 'Confirmed', 'Active', 'Complete', 'Partially_Delivered', 'Lost', 'Damaged', 'Cancelled'))
);

CREATE TABLE IF NOT EXISTS shipping_order_db.PARCEL (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES shipping_order_db.ORDER(id),
    route_id UUID, -- Logical FK to ROUTE.id
    declared_weight_grams INT NOT NULL CHECK (declared_weight_grams > 0),
    actual_weight_grams INT CHECK (actual_weight_grams > 0),
    type VARCHAR(50) NOT NULL CHECK (type IN ('parcel', 'pallet')),
    direction VARCHAR(50) NOT NULL CHECK (direction IN ('Forward', 'Reverse_RTS')),
    state VARCHAR(50) NOT NULL CHECK (state IN ('Created', 'InHub', 'InTransit', 'Misrouted', 'OutForDelivery', 'Delivered', 'Lost', 'Damaged')),
    sla_expected_delivery TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shipping_order_db.PAYMENT (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES shipping_order_db.ORDER(id) UNIQUE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('PREPAID_STRIPE')),
    amount_cents INT NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Unpaid', 'Paid', 'Awaiting_Settlement'))
);

CREATE TABLE IF NOT EXISTS shipping_order_db.STRIPE_TRANSACTION (
    id UUID PRIMARY KEY,
    payment_id UUID NOT NULL REFERENCES shipping_order_db.PAYMENT(id),
    stripe_intent_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_charge_id VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL
);

-- -----------------------------------------------------
-- 4. shipping_courier_db Tables
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_courier_db.COURIER (
    id UUID PRIMARY KEY,
    zone_id UUID NOT NULL, -- Logical FK to ZONE.id
    role VARCHAR(50) NOT NULL CHECK (role IN ('Courier', 'HubOperator', 'Dispatcher', 'Admin'))
);

CREATE TABLE IF NOT EXISTS shipping_courier_db.PROOF_OF_DELIVERY (
    id UUID PRIMARY KEY,
    scan_event_id UUID UNIQUE NOT NULL, -- Logical FK to TRACKING_EVENT.id
    parcel_id UUID NOT NULL,            -- Logical FK to PARCEL.id
    signature_url VARCHAR(500),
    photo_url VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS shipping_courier_db.DELIVERY_ATTEMPT (
    id UUID PRIMARY KEY,
    parcel_id UUID NOT NULL, -- Logical FK to PARCEL.id
    attempt_number INT NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
    failure_reason VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT uq_parcel_attempt UNIQUE (parcel_id, attempt_number)
);

-- -----------------------------------------------------
-- 5. shipping_tracking_db Tables
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_tracking_db.TRACKING_EVENT (
    id UUID PRIMARY KEY,
    parcel_id UUID NOT NULL,       -- Logical FK to PARCEL.id
    hub_id UUID,                  -- Logical FK to HUB.id
    courier_id UUID,              -- Logical FK to COURIER.id
    linehaul_trip_id UUID,        -- Logical FK to LINEHAULTRIP.id
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('PICKUP', 'HUB_RECEIVE', 'DEPARTED_LINEHAUL', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED', 'DELIVERED', 'MISROUTED', 'RTS')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
