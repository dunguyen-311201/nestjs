/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import Stripe from 'stripe';
import { randomUUID as uuidv4 } from 'node:crypto';

interface CreateOrderResult {
  shipment_order_id: string;
  price_cents: number;
  expected_delivery_at: string;
  status: string;
}

interface TrackingTimelineEntry {
  event_type: string;
  created_at: string;
  hub_id: string | null;
  courier_id: string | null;
  linehaul_trip_id: string | null;
}

interface TrackingResult {
  shipment_order_id: string;
  status: string | null;
  parcels: {
    parcel_id: string;
    state: string;
    timeline: TrackingTimelineEntry[];
  }[];
}

interface CreateTripResult {
  trip_id: string;
}

const runIntegration = process.env.RUN_INTEGRATION_TEST === 'true';

(runIntegration ? describe : describe.skip)(
  'End-to-End Happy Path Integration Test',
  () => {
    let dbClient: Client;
    let stripeSecret: string;
    const gatewayUrl = 'http://localhost:3000';
    const stripe = new Stripe('sk_test_placeholder', {
      apiVersion: '2022-11-15' as unknown as Stripe.LatestApiVersion,
    });

    beforeAll(async () => {
      // Read stripe secret from .env dynamically
      const envPath = path.join(__dirname, '../../../.env');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/^STRIPE_WEBHOOK_SECRET=(.*)$/m);
      stripeSecret = match ? match[1].trim() : 'whsec_placeholder';

      dbClient = new Client({
        connectionString:
          'postgresql://postgres:postgres@localhost:5432/postgres',
      });
      await dbClient.connect();

      // Reseed the database to a clean starting state using the seed.sql script
      // Since seed.sql TRUNCATEs first, this ensures a clean, isolated state for this E2E run.
      const seedSqlPath = path.join(__dirname, '../../../db/seed.sql');
      const seedSql = fs.readFileSync(seedSqlPath, 'utf8');
      await dbClient.query(seedSql);
    });

    afterAll(async () => {
      if (dbClient) {
        await dbClient.end();
      }
    });

    it('runs the full E2E parcel lifecycle successfully', async () => {
      const randomSuffix = Math.floor(Math.random() * 1000000);
      const senderPhone = `+849${randomSuffix}`;
      const recipientPhone = `+848${randomSuffix}`;
      const idempotencyKey = uuidv4();

      // 1. Create Order via API Gateway
      const createOrderPayload = {
        sender: {
          name: 'Sender E2E',
          phone: senderPhone,
          address: '123 Sender St, REG-100',
          region_code: 'REG-100',
        },
        recipient: {
          name: 'Recipient E2E',
          phone: recipientPhone,
          address: '456 Recipient St, REG-101',
          region_code: 'REG-101',
        },
        parcels: [
          {
            declared_weight_grams: 750,
            type: 'parcel',
          },
        ],
        payment_type: 'PREPAID_STRIPE',
      };

      const createOrderRes = await fetch(`${gatewayUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(createOrderPayload),
      });

      expect(createOrderRes.status).toBe(201);
      const createOrderData =
        (await createOrderRes.json()) as CreateOrderResult;

      const shipmentOrderId = createOrderData.shipment_order_id;
      expect(shipmentOrderId).toBeDefined();
      expect(createOrderData.status).toBe('Created'); // Initial state is Created

      // 2. Query DB to get the generated parcel ID
      const parcelRows = await dbClient.query<{ id: string }>(
        'SELECT id FROM shipping_order_db.PARCEL WHERE shipment_order_id = $1',
        [shipmentOrderId],
      );
      expect(parcelRows.rows.length).toBe(1);
      const parcelId = parcelRows.rows[0].id;
      expect(parcelId).toBeDefined();

      // 3. Simulate Stripe Webhook Payment Success via API Gateway
      const webhookPayload = {
        id: `evt_${randomSuffix}`,
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: shipmentOrderId,
            payment_intent: `pi_${randomSuffix}`,
            payment_status: 'paid',
          },
        },
      };
      const webhookRawBody = JSON.stringify(webhookPayload);
      const stripeSignature = stripe.webhooks.generateTestHeaderString({
        payload: webhookRawBody,
        secret: stripeSecret,
      });

      const webhookRes = await fetch(`${gatewayUrl}/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': stripeSignature,
        },
        body: webhookRawBody,
      });
      expect(webhookRes.status).toBe(200);

      // 5. Wait for outbox poller and NATS status projection to update the order status
      let orderStatus = '';
      for (let i = 0; i < 20; i++) {
        const orderRows = await dbClient.query<{ status: string }>(
          'SELECT status FROM shipping_order_db.SHIPMENT_ORDER WHERE id = $1',
          [shipmentOrderId],
        );
        orderStatus = orderRows.rows[0]?.status ?? '';
        if (orderStatus === 'Confirmed') {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(orderStatus).toBe('Confirmed');

      // 6. Verify payment is Paid
      const paymentRows = await dbClient.query<{ status: string }>(
        'SELECT status FROM shipping_order_db.PAYMENT WHERE shipment_order_id = $1',
        [shipmentOrderId],
      );
      expect(paymentRows.rows[0].status).toBe('Paid');

      // 7. Courier pickup
      const courierId = 'a354903c-86fe-468f-8c6e-4001f10e046b'; // Active courier in REG-100
      const courierPickupRes = await fetch(
        `${gatewayUrl}/couriers/parcels/${parcelId}/pickup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': uuidv4(),
          },
          body: JSON.stringify({ courier_id: courierId }),
        },
      );
      expect(courierPickupRes.status).toBe(201);

      // 8. Wait for Tracking event store to record PICKUP
      let trackingEvents: string[] = [];
      for (let i = 0; i < 15; i++) {
        const trackingRows = await dbClient.query<{ event_type: string }>(
          'SELECT event_type FROM shipping_tracking_db.TRACKING_EVENT WHERE parcel_id = $1',
          [parcelId],
        );
        trackingEvents = trackingRows.rows.map((r) => r.event_type);
        if (trackingEvents.includes('PICKUP')) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(trackingEvents).toContain('PICKUP');

      // 9. Hub inbound scan (Origin Hub receive)
      const originHubId = '9befa823-dd9a-440c-bb9c-52f97946e64c'; // Hub-REG-100
      const hubReceiveRes = await fetch(
        `${gatewayUrl}/hubs/${originHubId}/receive`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': uuidv4(),
          },
          body: JSON.stringify({ parcel_id: parcelId }),
        },
      );
      expect(hubReceiveRes.status).toBe(201);

      // 10. Line-haul - Create Trip
      // (Dispatcher's leg-assign moved below, after the parcel actually
      // arrives at the destination hub - task 7.3 made it publish
      // parcel.out_for_delivery, so assigning a courier before the parcel
      // has even left the origin hub would jump PARCEL.state to
      // OutForDelivery way too early, skipping DEPARTED_LINEHAUL/
      // ARRIVED_AT_HUB entirely. Real-world ordering: a courier is
      // assigned once the parcel is locally at the destination hub, ready
      // for last-mile dispatch, not before line-haul has even run.)
      const destHubId = 'bd332ddb-dfe6-4f3f-aaa8-5a4519435471'; // Hub-REG-101
      const createTripRes = await fetch(`${gatewayUrl}/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': uuidv4(),
        },
        body: JSON.stringify({
          origin_hub_id: originHubId,
          dest_hub_id: destHubId,
          parcel_ids: [parcelId],
        }),
      });
      expect(createTripRes.status).toBe(201);
      const createTripData = (await createTripRes.json()) as CreateTripResult;
      const tripId = createTripData.trip_id;
      expect(tripId).toBeDefined();

      // 12. Dispatcher - Assign Driver and Truck to Trip
      const driverId = '81911218-e523-4689-a660-2c72d9864b82';
      const truckId = 'd85c64fa-d8e7-42d1-9124-297c73be96a8';
      const tripAssignRes = await fetch(
        `${gatewayUrl}/trips/${tripId}/assign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': uuidv4(),
          },
          body: JSON.stringify({
            driver_id: driverId,
            truck_id: truckId,
          }),
        },
      );
      expect(tripAssignRes.status).toBe(201);

      // 13. Line-haul - Depart Trip
      const tripDepartRes = await fetch(
        `${gatewayUrl}/trips/${tripId}/depart`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': uuidv4(),
          },
        },
      );
      expect(tripDepartRes.status).toBe(201);

      // 14. Line-haul - Arrive Trip
      const tripArriveRes = await fetch(
        `${gatewayUrl}/trips/${tripId}/arrive`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': uuidv4(),
          },
        },
      );
      expect(tripArriveRes.status).toBe(201);

      // 15. Hub inbound scan (Destination Hub receive) - publishes
      // parcel.arrived_at_hub (InTransit -> InHub)
      const destHubReceiveRes = await fetch(
        `${gatewayUrl}/hubs/${destHubId}/receive`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': uuidv4(),
          },
          body: JSON.stringify({
            parcel_id: parcelId,
            linehaul_trip_id: tripId,
          }),
        },
      );
      expect(destHubReceiveRes.status).toBe(201);

      // 16. Dispatcher - Assign courier to leg - publishes
      // parcel.out_for_delivery (InHub -> OutForDelivery, task 7.3)
      const legAssignRes = await fetch(
        `${gatewayUrl}/parcels/${parcelId}/assign-courier`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': uuidv4(),
          },
          body: JSON.stringify({ courier_id: courierId }),
        },
      );
      expect(legAssignRes.status).toBe(201);
      expect(await legAssignRes.json()).toEqual({ status: 'recorded' });

      // Wait for parcel.out_for_delivery to actually land before delivering
      // - it's published async via Dispatcher's own outbox poller, and has
      // no ordering guarantee relative to Courier's /deliver call if the
      // two race (both are independent async pollers).
      let preDeliveryState = '';
      for (let i = 0; i < 15; i++) {
        const rows = await dbClient.query<{ state: string }>(
          'SELECT state FROM shipping_order_db.PARCEL WHERE id = $1',
          [parcelId],
        );
        preDeliveryState = rows.rows[0]?.state ?? '';
        if (preDeliveryState === 'OutForDelivery') {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(preDeliveryState).toBe('OutForDelivery');

      // 17. Courier - Deliver Parcel
      const destCourierId = 'f248fcf6-b127-4375-9c34-eef04be4de76'; // Active courier in dest zone REG-101
      const courierDeliverRes = await fetch(
        `${gatewayUrl}/couriers/parcels/${parcelId}/deliver`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': uuidv4(),
          },
          body: JSON.stringify({
            courier_id: destCourierId,
            outcome: 'DELIVERED',
            signature_url: 'https://example.com/sig.png',
            photo_url: 'https://example.com/photo.png',
          }),
        },
      );
      expect(courierDeliverRes.status).toBe(201);

      // 16. Wait and Verify Final Tracking Timeline via API Gateway
      let finalState = '';
      let finalEvents: string[] = [];
      for (let i = 0; i < 20; i++) {
        const trackingRes = await fetch(
          `${gatewayUrl}/tracking/${shipmentOrderId}`,
        );
        if (trackingRes.status === 200) {
          const trackingData = (await trackingRes.json()) as TrackingResult;
          const parcelInfo = trackingData.parcels?.find(
            (p) => p.parcel_id === parcelId,
          );
          if (parcelInfo) {
            finalState = parcelInfo.state;
            finalEvents = parcelInfo.timeline.map((e) => e.event_type);
            if (finalState === 'Delivered') {
              break;
            }
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(finalState).toBe('Delivered');
      expect(finalEvents).toEqual([
        'PICKUP',
        'HUB_RECEIVE',
        'DEPARTED_LINEHAUL',
        'ARRIVED_AT_HUB',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
      ]);
    }, 60000);
  },
);
