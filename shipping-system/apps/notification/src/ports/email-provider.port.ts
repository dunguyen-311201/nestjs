export abstract class IEmailProvider {
  abstract send(
    referenceId: string,
    subject: string,
    body: string,
  ): Promise<void>;
}
