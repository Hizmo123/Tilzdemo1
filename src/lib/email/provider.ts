// Provider-agnostic email abstraction — same shape as the SMS/payments
// abstractions. The app depends only on this interface; a mock runs until a
// real provider is configured, and drops in behind it without touching call
// sites.

export type EmailResult = {
  ok: boolean;
  provider: string;
  test: boolean; // true = nothing really sent (mock)
  error?: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailProvider {
  readonly name: string;
  readonly isTest: boolean;
  send(input: SendEmailInput): Promise<EmailResult>;
}
