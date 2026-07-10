const { connect, JSONCodec } = require('nats');

async function main() {
  const subject = process.argv[2];
  const payloadStr = process.argv[3];
  
  if (!subject || !payloadStr) {
    console.error('Usage: node scripts/publish-event.js <subject> <payload_json>');
    process.exit(1);
  }
  
  let payload;
  try {
    payload = JSON.parse(payloadStr);
  } catch (err) {
    console.error('Invalid JSON payload:', err.message);
    process.exit(1);
  }
  
  const nc = await connect({ servers: process.env.NATS_URL ?? 'nats://localhost:4222' });
  const codec = JSONCodec();
  nc.publish(subject, codec.encode(payload));
  await nc.drain();
  console.log(`Successfully published to subject "${subject}"`);
}

main().catch(console.error);
