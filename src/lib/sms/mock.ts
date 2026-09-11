import type { SmsProvider, SmsResult } from "./provider";

// Dev SMS provider. Sends nothing — it logs the message server-side and returns
// it as devBody so flows that need the content (OTP codes) work without a real
// gateway. Used until Twilio credentials are configured.
export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";
  readonly isTest = true;

  async send(to: string, body: string): Promise<SmsResult> {
    console.log(`[sms:mock] -> ${to}: ${body}`);
    return { ok: true, provider: "mock", test: true, devBody: body };
  }
}
