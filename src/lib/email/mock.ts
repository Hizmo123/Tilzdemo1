import type { EmailProvider, EmailResult, SendEmailInput } from "./provider";

// Dev email provider. Sends nothing — logs the email server-side so receipt
// delivery is testable without a real mail gateway. Used until RESEND_API_KEY
// is configured.
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock";
  readonly isTest = true;

  async send(input: SendEmailInput): Promise<EmailResult> {
    console.log(`[email:mock] -> ${input.to}: ${input.subject}`);
    return { ok: true, provider: "mock", test: true };
  }
}
