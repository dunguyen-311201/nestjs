import type { JetStreamManager } from 'nats';

export const SHIPMENT_ORDER_STATUS_STREAM = 'SHIPMENT_ORDER_STATUS';

// Idempotent: JetStream has no "create if not exists" API, so retry-safe
// startup means attempting the add and swallowing the one expected error.
export async function ensureShipmentOrderStatusStream(
  jsm: JetStreamManager,
): Promise<void> {
  try {
    await jsm.streams.add({
      name: SHIPMENT_ORDER_STATUS_STREAM,
      subjects: ['shipment_orders.status.>'],
    });
  } catch (error) {
    if (!(error as Error).message.includes('already in use')) {
      throw error;
    }
  }
}
