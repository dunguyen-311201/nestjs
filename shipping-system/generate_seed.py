import uuid
import random
import hashlib
from datetime import datetime, timedelta

def gen_uuid():
    return str(uuid.uuid4())

# Set random seed for deterministic generation
random.seed(42)

# Define zones, hubs, drivers, trucks, couriers
zones = []
hubs = []
routes = []
ratecards = []
couriers = []
drivers = []
trucks = []
customers = []
orders = []
parcels = []
payments = []
stripe_txs = []
trips = []
scan_events = []
delivery_proofs = []
delivery_attempts = []
cod_settlements = []

# 1. Generate 10 Zones & Hubs
zone_ids = [gen_uuid() for _ in range(10)]
hub_ids = [gen_uuid() for _ in range(10)]
region_codes = [f"REG-{100 + i}" for i in range(10)]

for i in range(10):
    zones.append((zone_ids[i], region_codes[i]))
    hubs.append((hub_ids[i], zone_ids[i], f"Hub-{region_codes[i]}"))

# 2. Generate Routes & Rate Cards (All combinations)
for i in range(10):
    for j in range(10):
        if i == j:
            continue
        route_id = gen_uuid()
        routes.append((route_id, zone_ids[i], zone_ids[j]))
        
        # Rate card for parcel
        ratecards.append((gen_uuid(), zone_ids[i], zone_ids[j], "parcel", random.randint(1500, 3000), random.randint(2, 5))) # $15 - $30, 2-5 day SLA
        # Rate card for pallet
        ratecards.append((gen_uuid(), zone_ids[i], zone_ids[j], "pallet", random.randint(8000, 15000), random.randint(4, 7))) # $80 - $150, 4-7 day SLA

# 3. Generate 20 Couriers
courier_ids = [gen_uuid() for _ in range(20)]
for cid in courier_ids:
    couriers.append((cid, random.choice(zone_ids), "Courier"))

# 4. Generate 10 Drivers and 10 Trucks
driver_ids = [gen_uuid() for _ in range(10)]
truck_ids = [gen_uuid() for _ in range(10)]
for i in range(10):
    drivers.append((driver_ids[i], f"Driver-Encrypted-Name-{i}"))
    trucks.append((truck_ids[i], f"29C-{10000 + i}"))

# 5. Generate 50 Line-haul Trips
trip_ids = [gen_uuid() for _ in range(50)]
for tid in trip_ids:
    origin_hub = random.choice(hubs)
    dest_hub = random.choice([h for h in hubs if h[0] != origin_hub[0]])
    trips.append((tid, origin_hub[0], dest_hub[0], random.choice(driver_ids), random.choice(truck_ids)))

# 6. Generate 500 Customers
customer_ids = [gen_uuid() for _ in range(500)]
for i, cid in enumerate(customer_ids):
    customers.append((
        cid,
        f"Customer-Encrypted-Name-{i}",
        f"Phone-Encrypted-{i}",
        hashlib.sha256(f"Phone-{i}".encode()).hexdigest(),
        f"Address-Encrypted-{i}",
        random.choice(region_codes)
    ))

# 7. Generate 1000 Orders
order_statuses = ["Draft", "Created", "Confirmed", "Active", "Complete", "Partially_Delivered", "Lost", "Damaged", "Cancelled"]
payment_types = ["PREPAID_STRIPE"]
payment_statuses = ["Unpaid", "Paid"]

start_date = datetime(2026, 6, 1)

for o_idx in range(1000):
    order_id = gen_uuid()
    sender = random.choice(customers)
    recipient = random.choice([c for c in customers if c[0] != sender[0]])
    
    # Find matching rate card
    sender_zone = None
    recipient_zone = None
    # Lookup zones based on customer region codes
    for z in zones:
        if z[1] == sender[4]:
            sender_zone = z[0]
        if z[1] == recipient[4]:
            recipient_zone = z[0]
    
    if not sender_zone or not recipient_zone or sender_zone == recipient_zone:
        # Fallback to random different zones if same region
        sender_zone = random.choice(zone_ids)
        recipient_zone = random.choice([z for z in zone_ids if z != sender_zone])
        
    matching_rcs = [rc for rc in ratecards if rc[1] == sender_zone and rc[2] == recipient_zone and rc[3] == "parcel"]
    rate_card = random.choice(matching_rcs) if matching_rcs else ratecards[0]
    
    # Logic to select Status based on workflow simulation
    # Let's skew status towards Complete and Active
    rand = random.random()
    if rand < 0.65:
        status = "Complete"
    elif rand < 0.85:
        status = "Active"
    elif rand < 0.90:
        status = "Confirmed"
    elif rand < 0.95:
        status = "Partially_Delivered"
    elif rand < 0.97:
        status = "Lost"
    elif rand < 0.99:
        status = "Cancelled"
    else:
        status = "Created"
        
    created_at = start_date + timedelta(minutes=o_idx * 45 + random.randint(0, 30))
    expected_delivery = created_at + timedelta(days=rate_card[5])

    price_cents = rate_card[4]
    
    orders.append((order_id, sender[0], recipient[0], rate_card[0], price_cents, expected_delivery, status, created_at))
    
    # 8. Generate 1 to 2 parcels per order
    num_parcels = random.choice([1, 1, 1, 2]) # Skew to 1 parcel mostly
    order_parcels = []
    
    # Lookup route
    matching_routes = [r for r in routes if r[1] == sender_zone and r[2] == recipient_zone]
    route_id = matching_routes[0][0] if matching_routes else routes[0][0]
    
    for p_idx in range(num_parcels):
        parcel_id = gen_uuid()
        declared_weight = random.randint(100, 5000) # 100g to 5kg
        
        # BR-06 weight mismatch simulation (15% of parcels)
        if random.random() < 0.15:
            actual_weight = declared_weight + random.choice([-500, -200, 300, 500])
            if actual_weight <= 0:
                actual_weight = declared_weight + 200
        else:
            actual_weight = declared_weight
            
        p_type = "parcel" if declared_weight < 4000 else "pallet"
        direction = "Forward"
        
        # Set parcel state based on order status
        if status == "Complete":
            p_state = "Delivered"
        elif status == "Active":
            p_state = random.choice(["InHub", "InTransit", "OutForDelivery"])
        elif status == "Confirmed":
            p_state = "Created"
        elif status == "Partially_Delivered":
            p_state = "Delivered" if p_idx == 0 else random.choice(["Lost", "Damaged"])
        elif status == "Lost":
            p_state = "Lost"
        elif status == "Damaged":
            p_state = "Damaged"
        elif status == "Cancelled":
            p_state = "Created"
        else:
            p_state = "Created"
            
        parcels.append((parcel_id, order_id, route_id, declared_weight, actual_weight, p_type, direction, p_state, expected_delivery))
        order_parcels.append((parcel_id, p_state, actual_weight))
        
    # 9. Generate Payments & Transactions
    pay_id = gen_uuid()
    p_type = "PREPAID_STRIPE"
    p_status = "Paid" if status not in ["Draft", "Created", "Cancelled"] else "Unpaid"
    payments.append((pay_id, order_id, p_type, price_cents, p_status))
    
    if p_type == "PREPAID_STRIPE" and p_status == "Paid":
        stripe_txs.append((
            gen_uuid(), 
            pay_id, 
            f"pi_{gen_uuid()[:15]}", 
            f"ch_{gen_uuid()[:15]}", 
            "succeeded", 
            created_at + timedelta(minutes=5)
        ))
        
    # 10. Generate Scan Events for tracking timeline
    for p_id, p_state, act_weight in order_parcels:
        origin_hub_id = [h[0] for h in hubs if h[1] == sender_zone][0]
        dest_hub_id = [h[0] for h in hubs if h[1] == recipient_zone][0]
        transit_hub_id = [h[0] for h in hubs if h[0] != origin_hub_id and h[0] != dest_hub_id][0]
        courier_id = random.choice(courier_ids)
        trip_id = random.choice(trip_ids)
        
        # Timeline always starts with PICKUP scan
        if p_state in ["InHub", "InTransit", "OutForDelivery", "Delivered", "Lost", "Damaged"]:
            # 1. Pickup Event
            scan_events.append((gen_uuid(), gen_uuid(), p_id, None, courier_id, None, "PICKUP", created_at + timedelta(hours=2)))
            
            # 2. Hub Inbound Event
            if p_state in ["InTransit", "OutForDelivery", "Delivered"]:
                scan_events.append((gen_uuid(), gen_uuid(), p_id, origin_hub_id, None, None, "HUB_RECEIVE", created_at + timedelta(hours=6)))
                
                # BR-02 Misrouted simulation (5% of in-transit orders)
                is_misrouted = (random.random() < 0.05)
                if is_misrouted:
                    misrouted_time = created_at + timedelta(hours=12)
                    scan_events.append((gen_uuid(), gen_uuid(), p_id, transit_hub_id, None, None, "MISROUTED", misrouted_time))
                    # Corrective route scan
                    scan_events.append((gen_uuid(), gen_uuid(), p_id, origin_hub_id, None, None, "HUB_RECEIVE", misrouted_time + timedelta(hours=4)))
                
                # 3. Depart Line-haul Event
                if p_state in ["OutForDelivery", "Delivered"]:
                    scan_events.append((gen_uuid(), gen_uuid(), p_id, None, None, trip_id, "DEPARTED_LINEHAUL", created_at + timedelta(hours=14)))
                    # 4. Arrive Hub Event
                    scan_events.append((gen_uuid(), gen_uuid(), p_id, dest_hub_id, None, None, "ARRIVED_AT_HUB", created_at + timedelta(hours=24)))
                    
                    # 5. Out for Delivery Event
                    if p_state == "Delivered":
                        scan_events.append((gen_uuid(), gen_uuid(), p_id, None, courier_id, None, "OUT_FOR_DELIVERY", created_at + timedelta(hours=28)))
                        
                        # 6. Delivered Event
                        del_event_id = gen_uuid()
                        scan_events.append((del_event_id, gen_uuid(), p_id, None, courier_id, None, "DELIVERED", created_at + timedelta(hours=30)))
                        
                        # 7. Proof of Delivery
                        # No tracking_event_id: Courier writes this row synchronously,
                        # before Tracking (async, cross-schema) appends the DELIVERED
                        # event above — there's no such ID to reference at write time.
                        delivery_proofs.append((
                            gen_uuid(),
                            p_id,
                            f"http://cdn.shipping.com/sigs/{gen_uuid()}.png",
                            f"http://cdn.shipping.com/photos/{gen_uuid()}.jpg"
                        ))
                    elif p_state == "OutForDelivery":
                        scan_events.append((gen_uuid(), gen_uuid(), p_id, None, courier_id, None, "OUT_FOR_DELIVERY", created_at + timedelta(hours=28)))
                elif p_state == "InTransit":
                    scan_events.append((gen_uuid(), gen_uuid(), p_id, None, None, trip_id, "DEPARTED_LINEHAUL", created_at + timedelta(hours=14)))
            elif p_state == "InHub":
                scan_events.append((gen_uuid(), gen_uuid(), p_id, origin_hub_id, None, None, "HUB_RECEIVE", created_at + timedelta(hours=6)))

        # BR-04 RTS simulation (3 failed attempts followed by RTS transition)
        # We simulate this for a portion of Delivered/Partially_Delivered orders that were returned
        if p_state == "Delivered" and random.random() < 0.05:
            # Modify latest scan to be RTS
            rts_p_id = p_id
            rts_time = created_at + timedelta(hours=40)
            
            # Write 3 failed attempts
            for attempt in range(1, 4):
                attempt_time = created_at + timedelta(hours=30 + attempt * 2)
                attempt_id = gen_uuid()
                delivery_attempts.append((attempt_id, rts_p_id, attempt, "Customer absent", attempt_time))
                scan_events.append((gen_uuid(), gen_uuid(), rts_p_id, None, courier_id, None, "DELIVERY_FAILED", attempt_time))
            
            # Trigger RTS scan event
            scan_events.append((gen_uuid(), gen_uuid(), rts_p_id, None, courier_id, None, "RTS", rts_time))
            # Quet inbound tai kho nguoi gui de hoan tra
            scan_events.append((gen_uuid(), gen_uuid(), rts_p_id, origin_hub_id, None, None, "ARRIVED_AT_HUB", rts_time + timedelta(hours=12)))
            
            # Overwrite state to show RTS was completed
            # Find parcel and modify direction/state
            for idx, p in enumerate(parcels):
                if p[0] == rts_p_id:
                    parcels[idx] = (p[0], p[1], p[2], p[3], p[4], p[5], "Reverse_RTS", "InHub", p[8])
                    


# 12. Write seed.sql file
with open("db/seed.sql", "w") as f:
    f.write("-- Database Seed Data\n")
    f.write("BEGIN;\n\n")
    
    f.write("TRUNCATE shipping_tracking_db.TRACKING_EVENT, shipping_courier_db.PROOF_OF_DELIVERY, shipping_courier_db.DELIVERY_ATTEMPT, shipping_courier_db.COURIER, shipping_order_db.PAYMENT_TRANSACTION, shipping_order_db.PAYMENT, shipping_order_db.PARCEL, shipping_order_db.SHIPMENT_ORDER, shipping_order_db.CUSTOMER, shipping_pricing_db.RATECARD, shipping_network_db.LINEHAULTRIP, shipping_network_db.TRUCK, shipping_network_db.DRIVER, shipping_network_db.ROUTE, shipping_network_db.HUB, shipping_network_db.ZONE CASCADE;\n\n")
    
    # 1. Insert Zones
    f.write("-- Zones\n")
    for row in zones:
        f.write(f"INSERT INTO shipping_network_db.ZONE (id, region_code) VALUES ('{row[0]}', '{row[1]}');\n")
    f.write("\n")
    
    # 2. Insert Hubs
    f.write("-- Hubs\n")
    for row in hubs:
        f.write(f"INSERT INTO shipping_network_db.HUB (id, zone_id, name) VALUES ('{row[0]}', '{row[1]}', '{row[2]}');\n")
    f.write("\n")
    
    # 3. Insert Routes
    f.write("-- Routes\n")
    for row in routes:
        f.write(f"INSERT INTO shipping_network_db.ROUTE (id, origin_zone_id, dest_zone_id) VALUES ('{row[0]}', '{row[1]}', '{row[2]}');\n")
    f.write("\n")
    
    # 4. Insert Drivers & Trucks
    f.write("-- Drivers & Trucks\n")
    for row in drivers:
        f.write(f"INSERT INTO shipping_network_db.DRIVER (id, name_enc) VALUES ('{row[0]}', '{row[1]}');\n")
    for row in trucks:
        f.write(f"INSERT INTO shipping_network_db.TRUCK (id, plate) VALUES ('{row[0]}', '{row[1]}');\n")
    f.write("\n")
    
    # 5. Insert Linehaul Trips
    f.write("-- Linehaul Trips\n")
    for row in trips:
        f.write(f"INSERT INTO shipping_network_db.LINEHAULTRIP (id, origin_hub_id, dest_hub_id, driver_id, truck_id) VALUES ('{row[0]}', '{row[1]}', '{row[2]}', '{row[3]}', '{row[4]}');\n")
    f.write("\n")
    
    # 6. Insert Rate Cards
    f.write("-- Rate Cards\n")
    for row in ratecards:
        f.write(f"INSERT INTO shipping_pricing_db.RATECARD (id, origin_zone_id, dest_zone_id, parcel_type, price_cents, sla_days) VALUES ('{row[0]}', '{row[1]}', '{row[2]}', '{row[3]}', {row[4]}, {row[5]});\n")
    f.write("\n")
    
    # 7. Insert Couriers
    f.write("-- Couriers\n")
    for row in couriers:
        f.write(f"INSERT INTO shipping_courier_db.COURIER (id, zone_id, role) VALUES ('{row[0]}', '{row[1]}', '{row[2]}');\n")
    f.write("\n")
    
    # 8. Insert Customers
    f.write("-- Customers\n")
    for row in customers:
        f.write(f"INSERT INTO shipping_order_db.CUSTOMER (id, name_enc, phone_enc, phone_hash, address_enc, region_code) VALUES ('{row[0]}', '{row[1]}', '{row[2]}', '{row[3]}', '{row[4]}', '{row[5]}');\n")
    f.write("\n")
    
    # 9. Insert Orders (Chủ động chia nhỏ để tránh lệnh INSERT quá dài)
    f.write("-- Orders\n")
    for row in orders:
        f.write(f"INSERT INTO shipping_order_db.SHIPMENT_ORDER (id, sender_id, recipient_id, rate_card_id, price_cents, expected_delivery_at, status) VALUES ('{row[0]}', '{row[1]}', '{row[2]}', '{row[3]}', {row[4]}, '{row[5].isoformat()}', '{row[6]}');\n")
    f.write("\n")
    
    # 10. Insert Parcels
    f.write("-- Parcels\n")
    for row in parcels:
        actual_weight_str = str(row[4]) if row[4] is not None else "NULL"
        sla_str = f"'{row[8].isoformat()}'" if row[8] is not None else "NULL"
        f.write(f"INSERT INTO shipping_order_db.PARCEL (id, shipment_order_id, route_id, declared_weight_grams, actual_weight_grams, type, direction, state, sla_expected_delivery) VALUES ('{row[0]}', '{row[1]}', '{row[2]}', {row[3]}, {actual_weight_str}, '{row[5]}', '{row[6]}', '{row[7]}', {sla_str});\n")
    f.write("\n")
    
    # 11. Insert Payments
    f.write("-- Payments\n")
    for row in payments:
        f.write(f"INSERT INTO shipping_order_db.PAYMENT (id, shipment_order_id, type, amount_cents, status) VALUES ('{row[0]}', '{row[1]}', '{row[2]}', {row[3]}, '{row[4]}');\n")
    f.write("\n")
    
    # 12. Insert Payment Transactions
    f.write("-- Payment Transactions\n")
    for row in stripe_txs:
        f.write(f"INSERT INTO shipping_order_db.PAYMENT_TRANSACTION (id, payment_id, provider, external_transaction_id, external_reference_id, status, created_at) VALUES ('{row[0]}', '{row[1]}', 'STRIPE', '{row[2]}', '{row[3]}', '{row[4]}', '{row[5].isoformat()}');\n")
    f.write("\n")
    
    # 13. Insert Scan Events
    f.write("-- Scan Events\n")
    for row in scan_events:
        hub_str = f"'{row[3]}'" if row[3] else "NULL"
        courier_str = f"'{row[4]}'" if row[4] else "NULL"
        trip_str = f"'{row[5]}'" if row[5] else "NULL"
        f.write(f"INSERT INTO shipping_tracking_db.TRACKING_EVENT (id, event_id, parcel_id, hub_id, courier_id, linehaul_trip_id, event_type, created_at) VALUES ('{row[0]}', '{row[1]}', '{row[2]}', {hub_str}, {courier_str}, {trip_str}, '{row[6]}', '{row[7].isoformat()}');\n")
    f.write("\n")
    
    # 14. Insert Delivery Proofs
    f.write("-- Delivery Proofs\n")
    for row in delivery_proofs:
        f.write(f"INSERT INTO shipping_courier_db.PROOF_OF_DELIVERY (id, parcel_id, signature_url, photo_url) VALUES ('{row[0]}', '{row[1]}', '{row[2]}', '{row[3]}');\n")
    f.write("\n")
    
    # 15. Insert Delivery Attempts
    f.write("-- Delivery Attempts\n")
    for row in delivery_attempts:
        f.write(f"INSERT INTO shipping_courier_db.DELIVERY_ATTEMPT (id, parcel_id, attempt_number, outcome, failure_reason, created_at) VALUES ('{row[0]}', '{row[1]}', {row[2]}, 'Failed', '{row[3]}', '{row[4].isoformat()}');\n")
    
    f.write("\nCOMMIT;\n")

print("Generated seed.sql successfully with 1000 orders and their operational dependencies!")
