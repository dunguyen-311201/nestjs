const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const Stripe = require('stripe');
const crypto = require('crypto');

// Colors for terminal logs
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const blue = (text) => `\x1b[34m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;

const gatewayUrl = 'http://localhost:3000';

function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    console.warn(yellow('Warning: .env file not found at project root. Using default values.'));
    return {};
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        env[key] = value;
      }
    }
  });
  return env;
}

async function waitAndPoll(message, checkFn, maxAttempts = 20, delay = 500) {
  process.stdout.write(cyan(`==> ${message} `));
  for (let i = 0; i < maxAttempts; i++) {
    process.stdout.write(cyan('.'));
    const result = await checkFn();
    if (result) {
      process.stdout.write('\n');
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  process.stdout.write('\n');
  throw new Error(`Timeout waiting for condition: ${message}`);
}

async function main() {
  console.log(blue('========================================================'));
  console.log(blue('         SHIPPING SYSTEM HAPPY-PATH DEMO SIMULATION    '));
  console.log(blue('========================================================'));

  const env = loadEnv();

  // Initialize DB connection
  const pgUser = env.POSTGRES_USER || 'postgres';
  const pgPassword = env.POSTGRES_PASSWORD || 'postgres';
  const pgHost = env.POSTGRES_HOST || 'localhost';
  const pgPort = env.POSTGRES_PORT || '5432';
  const pgDb = env.POSTGRES_DB || 'postgres';
  const dbConnectionString = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDb}`;

  const dbClient = new Client({ connectionString: dbConnectionString });
  
  try {
    await dbClient.connect();
    console.log(green('✔ Connected to PostgreSQL database successfully.'));
  } catch (err) {
    console.error(red('✘ Failed to connect to PostgreSQL. Is docker compose running?'), err.message);
    process.exit(1);
  }

  // Check health of Gateway
  try {
    const healthRes = await fetch(`${gatewayUrl}/health`);
    if (healthRes.ok) {
      console.log(green('✔ API Gateway is healthy at port 3000.'));
    } else {
      throw new Error(`Status: ${healthRes.status}`);
    }
  } catch (err) {
    console.error(red('✘ API Gateway is unreachable. Did you run "docker compose up -d"?'), err.message);
    await dbClient.end();
    process.exit(1);
  }

  // Reseed the database
  console.log(cyan('==> Reseeding database to clean starting state...'));
  try {
    const seedSql = fs.readFileSync(path.join(__dirname, '../db/seed.sql'), 'utf8');
    await dbClient.query(seedSql);
    console.log(green('✔ Database seeded successfully.'));
  } catch (err) {
    console.error(red('✘ Seeding failed:'), err.message);
    await dbClient.end();
    process.exit(1);
  }

  // Step 1: Create Order
  console.log('\n' + yellow('--- Step 1: Create a Prepaid Stripe Order ---'));
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const senderPhone = `+849${randomSuffix}`;
  const recipientPhone = `+848${randomSuffix}`;
  const idempotencyKey = crypto.randomUUID();

  const createOrderPayload = {
    sender: {
      name: 'Alice Nguyen',
      phone: senderPhone,
      address: '1 Alice St, Hanoi, REG-100',
      region_code: 'REG-100',
    },
    recipient: {
      name: 'Bob Tran',
      phone: recipientPhone,
      address: '456 Bob St, HCM, REG-101',
      region_code: 'REG-101',
    },
    parcels: [
      {
        declared_weight_grams: 500,
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

  if (!createOrderRes.ok) {
    console.error(red(`✘ Create Order failed: ${createOrderRes.status}`), await createOrderRes.text());
    await dbClient.end();
    process.exit(1);
  }

  const orderData = await createOrderRes.json();
  const orderId = orderData.shipment_order_id;
  const price = orderData.price_cents;
  console.log(green(`✔ Order Created successfully!`));
  console.log(`  Order ID:   ${cyan(orderId)}`);
  console.log(`  Price:      ${cyan((price / 100).toFixed(2))} USD`);
  console.log(`  Status:     ${cyan(orderData.status)}`);

  // Query DB to get the generated parcel ID
  const parcelRows = await dbClient.query(
    'SELECT id FROM shipping_order_db.parcel WHERE shipment_order_id = $1',
    [orderId]
  );
  const parcelId = parcelRows.rows[0].id;
  console.log(`  Parcel ID:  ${cyan(parcelId)}`);

  // Step 2: Simulate Payment
  console.log('\n' + yellow('--- Step 2: Simulating Stripe Webhook Payment Confirmation (BR-08) ---'));
  
  const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';
  const stripeSecretKey = env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2022-11-15',
  });

  const webhookPayload = {
    id: `evt_${randomSuffix}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        client_reference_id: orderId,
        payment_intent: `pi_${randomSuffix}`,
        payment_status: 'paid',
      },
    },
  };
  const webhookRawBody = JSON.stringify(webhookPayload);
  const stripeSignature = stripe.webhooks.generateTestHeaderString({
    payload: webhookRawBody,
    secret: stripeWebhookSecret,
  });

  const webhookRes = await fetch(`${gatewayUrl}/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': stripeSignature,
    },
    body: webhookRawBody,
  });

  if (!webhookRes.ok) {
    console.error(red(`✘ Webhook simulated fail: ${webhookRes.status}`), await webhookRes.text());
    await dbClient.end();
    process.exit(1);
  }

  console.log(green('✔ Webhook processed successfully by payment receiver.'));

  // Wait for status projection to recompute order status -> Confirmed
  await waitAndPoll('Waiting for order status to projection-update to Confirmed', async () => {
    const res = await dbClient.query(
      'SELECT status FROM shipping_order_db.shipment_order WHERE id = $1',
      [orderId]
    );
    return res.rows[0]?.status === 'Confirmed';
  });
  console.log(green('✔ Order projection updated. Order status: Confirmed.'));

  // Step 3: Courier Pickup
  console.log('\n' + yellow('--- Step 3: Courier Pick-up Scan ---'));
  const courierId = 'a354903c-86fe-468f-8c6e-4001f10e046b'; // Active courier in origin region REG-100
  
  const pickupRes = await fetch(`${gatewayUrl}/couriers/legs/${parcelId}/pickup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ courier_id: courierId }),
  });

  if (!pickupRes.ok) {
    console.error(red(`✘ Courier pickup failed: ${pickupRes.status}`), await pickupRes.text());
    await dbClient.end();
    process.exit(1);
  }
  console.log(green('✔ Courier pickup recorded successfully.'));

  // Wait for FSM state update in Order Service
  await waitAndPoll('Waiting for FSM to transition parcel state to InTransit', async () => {
    const res = await dbClient.query(
      'SELECT state FROM shipping_order_db.parcel WHERE id = $1',
      [parcelId]
    );
    return res.rows[0]?.state === 'InTransit';
  });
  console.log(green('✔ Parcel state updated: InTransit.'));

  // Step 4: Origin Hub Receive
  console.log('\n' + yellow('--- Step 4: Origin Hub Receive Scan (Re-weighing BR-06) ---'));
  const originHubId = '9befa823-dd9a-440c-bb9c-52f97946e64c'; // Hub-REG-100
  
  const hubReceiveRes = await fetch(`${gatewayUrl}/hubs/${originHubId}/receive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ parcel_id: parcelId }), // actual weight is measured by scan station scales
  });

  if (!hubReceiveRes.ok) {
    console.error(red(`✘ Origin hub receive failed: ${hubReceiveRes.status}`), await hubReceiveRes.text());
    await dbClient.end();
    process.exit(1);
  }
  console.log(green('✔ Origin hub scan recorded successfully.'));

  // Wait for FSM state update to InHub
  await waitAndPoll('Waiting for FSM to transition parcel state to InHub', async () => {
    const res = await dbClient.query(
      'SELECT state FROM shipping_order_db.parcel WHERE id = $1',
      [parcelId]
    );
    return res.rows[0]?.state === 'InHub';
  });
  console.log(green('✔ Parcel state updated: InHub.'));

  // Step 5: Line-haul Trip Creation
  console.log('\n' + yellow('--- Step 5: Line-haul Trip Creation ---'));
  const destHubId = 'bd332ddb-dfe6-4f3f-aaa8-5a4519435471'; // Hub-REG-101

  const tripRes = await fetch(`${gatewayUrl}/trips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      origin_hub_id: originHubId,
      dest_hub_id: destHubId,
      parcel_ids: [parcelId],
    }),
  });

  if (!tripRes.ok) {
    console.error(red(`✘ Linehaul trip creation failed: ${tripRes.status}`), await tripRes.text());
    await dbClient.end();
    process.exit(1);
  }

  const tripData = await tripRes.json();
  const tripId = tripData.trip_id;
  console.log(green(`✔ Line-haul trip created successfully! Trip ID: ${cyan(tripId)}`));

  // Step 6: Dispatch Driver and Truck
  console.log('\n' + yellow('--- Step 6: Assigning Driver and Truck to Trip ---'));
  const driverId = '81911218-e523-4689-a660-2c72d9864b82';
  const truckId = 'd85c64fa-d8e7-42d1-9124-297c73be96a8';

  const assignTripRes = await fetch(`${gatewayUrl}/trips/${tripId}/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      driver_id: driverId,
      truck_id: truckId,
    }),
  });

  if (!assignTripRes.ok) {
    console.error(red(`✘ Trip assignment failed: ${assignTripRes.status}`), await assignTripRes.text());
    await dbClient.end();
    process.exit(1);
  }
  console.log(green('✔ Driver and truck assigned successfully.'));

  // Step 7: Depart Line-haul Trip
  console.log('\n' + yellow('--- Step 7: Departing Line-haul Trip ---'));
  const departRes = await fetch(`${gatewayUrl}/trips/${tripId}/depart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
  });

  if (!departRes.ok) {
    console.error(red(`✘ Depart trip failed: ${departRes.status}`), await departRes.text());
    await dbClient.end();
    process.exit(1);
  }
  console.log(green('✔ Line-haul trip departed.'));

  // Wait for FSM state update to InTransit
  await waitAndPoll('Waiting for FSM to transition parcel state back to InTransit', async () => {
    const res = await dbClient.query(
      'SELECT state FROM shipping_order_db.parcel WHERE id = $1',
      [parcelId]
    );
    return res.rows[0]?.state === 'InTransit';
  });
  console.log(green('✔ Parcel state updated: InTransit (heading to destination).'));

  // Step 8: Arrive Line-haul Trip
  console.log('\n' + yellow('--- Step 8: Arriving Line-haul Trip ---'));
  const arriveRes = await fetch(`${gatewayUrl}/trips/${tripId}/arrive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
  });

  if (!arriveRes.ok) {
    console.error(red(`✘ Arrive trip failed: ${arriveRes.status}`), await arriveRes.text());
    await dbClient.end();
    process.exit(1);
  }
  console.log(green('✔ Line-haul trip arrived at destination hub.'));

  // Step 9: Destination Hub Receive Scan
  console.log('\n' + yellow('--- Step 9: Destination Hub Receive Scan ---'));
  const destHubReceiveRes = await fetch(`${gatewayUrl}/hubs/${destHubId}/receive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      parcel_id: parcelId,
      linehaul_trip_id: tripId,
    }),
  });

  if (!destHubReceiveRes.ok) {
    console.error(red(`✘ Destination hub receive failed: ${destHubReceiveRes.status}`), await destHubReceiveRes.text());
    await dbClient.end();
    process.exit(1);
  }
  console.log(green('✔ Destination hub receive scan recorded successfully.'));

  // Wait for FSM state update to InHub
  await waitAndPoll('Waiting for FSM to transition parcel state to InHub at destination', async () => {
    const res = await dbClient.query(
      'SELECT state FROM shipping_order_db.parcel WHERE id = $1',
      [parcelId]
    );
    return res.rows[0]?.state === 'InHub';
  });
  console.log(green('✔ Parcel state updated: InHub (at destination).'));

  // Step 10: Assign Courier to Leg (Dispatcher)
  console.log('\n' + yellow('--- Step 10: Assigning Last-Mile Courier (Dispatcher) ---'));
  const destCourierId = 'f248fcf6-b127-4375-9c34-eef04be4de76'; // Active courier in dest zone REG-101

  const legAssignRes = await fetch(`${gatewayUrl}/legs/${parcelId}/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ courier_id: destCourierId }),
  });

  if (!legAssignRes.ok) {
    console.error(red(`✘ Leg assignment failed: ${legAssignRes.status}`), await legAssignRes.text());
    await dbClient.end();
    process.exit(1);
  }
  console.log(green('✔ Courier assigned last-mile leg.'));

  // Wait for FSM state update to OutForDelivery
  await waitAndPoll('Waiting for FSM to transition parcel state to OutForDelivery', async () => {
    const res = await dbClient.query(
      'SELECT state FROM shipping_order_db.parcel WHERE id = $1',
      [parcelId]
    );
    return res.rows[0]?.state === 'OutForDelivery';
  });
  console.log(green('✔ Parcel state updated: OutForDelivery.'));

  // Step 11: Deliver Parcel
  console.log('\n' + yellow('--- Step 11: Courier Last-Mile Delivery (Delivered) ---'));
  
  const deliverRes = await fetch(`${gatewayUrl}/couriers/legs/${parcelId}/deliver`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      courier_id: destCourierId,
      outcome: 'DELIVERED',
      signature_url: 'https://example.com/sig.png',
      photo_url: 'https://example.com/photo.png',
    }),
  });

  if (!deliverRes.ok) {
    console.error(red(`✘ Delivery failed: ${deliverRes.status}`), await deliverRes.text());
    await dbClient.end();
    process.exit(1);
  }
  console.log(green('✔ Delivery recorded. Proof of delivery saved.'));

  // Wait for FSM state update to Delivered
  await waitAndPoll('Waiting for FSM to transition parcel state to Delivered', async () => {
    const res = await dbClient.query(
      'SELECT state FROM shipping_order_db.parcel WHERE id = $1',
      [parcelId]
    );
    return res.rows[0]?.state === 'Delivered';
  });
  console.log(green('✔ Parcel state updated: Delivered.'));

  // Wait for Order Projection to cascade to Complete
  await waitAndPoll('Waiting for order status to update to Complete', async () => {
    const res = await dbClient.query(
      'SELECT status FROM shipping_order_db.shipment_order WHERE id = $1',
      [orderId]
    );
    return res.rows[0]?.status === 'Complete';
  });
  console.log(green('✔ Order projection updated. Order status: Complete.'));

  // Fetch final tracking result
  console.log('\n' + yellow('--- Step 12: Querying Final Tracking Timeline (UC-04) ---'));
  const trackingRes = await fetch(`${gatewayUrl}/tracking/${orderId}`);
  if (trackingRes.ok) {
    const trackingData = await trackingRes.json();
    console.log(green('✔ Final Tracking Timeline fetched successfully:'));
    console.log(JSON.stringify(trackingData, null, 2));
  } else {
    console.error(red('✘ Failed to query final tracking timeline:'), trackingRes.status);
  }

  // Check notification email emulator logs
  console.log('\n' + yellow('--- Step 13: Checking Notification Email Emulator Logs (BR-09) ---'));
  console.log(blue('Wait 2 seconds to let the NATS Notification consumer process emails...'));
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  // Since we cannot easily run 'docker compose logs' inside node directly without exec,
  // let's run a simple exec wrapper to print the LoggingEmailAdapter logs for this order ID.
  // Uses execFileSync (no shell) + in-process filtering, not string-interpolated
  // execSync - orderId comes from an API response and must never be
  // concatenated into a shell command string.
  const { execFileSync } = require('child_process');
  try {
    const orderIdPrefix = orderId.slice(0, 8);
    const allLogs = execFileSync(
      'docker',
      ['compose', 'logs', 'notification', '--no-log-prefix'],
      { encoding: 'utf8' },
    );
    const logs = allLogs
      .split('\n')
      .filter((line) => line.includes('EMAIL EMULATOR') && line.includes(orderIdPrefix))
      .join('\n');
    if (logs.trim()) {
      console.log(green('✔ Simulated Customer Emails Sent:'));
      console.log(logs.trim());
    } else {
      console.log(yellow('No emails found in logs. Check if notification service is running.'));
    }
  } catch (err) {
    console.error(yellow('Could not query docker logs:'), err.message);
  }

  console.log('\n' + blue('========================================================'));
  console.log(green('          DEMO RUN COMPLETED SUCCESSFULLY!              '));
  console.log(blue('========================================================'));

  await dbClient.end();
}

main().catch((err) => {
  console.error(red('✘ Demo run aborted with error:'), err);
  process.exit(1);
});
