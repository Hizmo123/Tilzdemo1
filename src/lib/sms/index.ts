import type { SmsProvider } from "./provider";
import { MockSmsProvider } from "./mock";
import { TwilioSmsProvider } from "./twilio";

// Picks the active SMS provider: Twilio when its env vars are set, otherwise the
// mock (dev). Cached per server instance.
let cached: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  cached =
    sid && token && from
      ? new TwilioSmsProvider(sid, token, from)
      : new MockSmsProvider();
  return cached;
}

// Convenience: send and swallow failures (notifications should never break the
// flow that triggered them). Returns the result for callers that care.
export async function sendSms(to: string, body: string) {
  try {
    return await getSmsProvider().send(to, body);
  } catch (e) {
    return {
      ok: false,
      provider: "unknown",
      test: false,
      error: e instanceof Error ? e.message : "SMS failed",
    };
  }
}

export type { SmsProvider, SmsResult } from "./provider";
