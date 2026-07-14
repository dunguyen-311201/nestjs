export abstract class IEventPublisher {
  abstract publish(
    subject: string,
    eventId: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
}
