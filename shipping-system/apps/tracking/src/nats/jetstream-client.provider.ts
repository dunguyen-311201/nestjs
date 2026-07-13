import { connect } from 'nats';

export const JETSTREAM_CLIENT = Symbol('JETSTREAM_CLIENT');

// Bootstrap wiring (a raw socket connection), not unit-tested per this
// codebase's convention - see TrackingEventConsumer's NATS connection setup.
export async function createJetStreamClient() {
  const nc = await connect({
    servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
  });
  return nc.jetstream();
}
