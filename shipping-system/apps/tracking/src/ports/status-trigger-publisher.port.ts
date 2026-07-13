export abstract class IStatusTriggerPublisher {
  abstract publish(shipmentOrderId: string): Promise<void>;
}
