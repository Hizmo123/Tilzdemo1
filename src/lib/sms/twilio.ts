import type { SmsProvider, SmsResult } from "./provider";

// Twilio SMS via its REST API (no SDK needed — a single authenticated POST).
// Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (an SMS-capable
// Twilio number in E.164, or an approved alphanumeric sender ID for AU one-way
// texts).
export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";
  readonly isTest = false;

  constructor(
    private accountSid: string,
    private authToken: string,
    private from: string,
  ) {}

  async send(to: string, body: string): Promise<SmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString(
      "base64",
    );
    const form = new URLSearchParams({ To: to, From: this.from, Body: body });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return {
          ok: false,
          provider: "twilio",
          test: false,
          error: `Twilio ${res.status}: ${detail.slice(0, 200)}`,
        };
      }
      return { ok: true, provider: "twilio", test: false };
    } catch (e) {
      return {
        ok: false,
        provider: "twilio",
        test: false,
        error: e instanceof Error ? e.message : "SMS send failed",
      };
    }
  }
}
