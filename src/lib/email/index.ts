import type { EmailProvider } from "./provider";
import { MockEmailProvider } from "./mock";
import { ResendEmailProvider } from "./resend";

// Picks the active email provider: Resend when its env vars are set,
// otherwise the mock (dev). Cached per server instance.
let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  cached = apiKey && from ? new ResendEmailProvider(apiKey, from) : new MockEmailProvider();
  return cached;
}

// Convenience: send and swallow failures (email delivery should never break
// the flow that triggered it). Returns the result for callers that care.
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  try {
    return await getEmailProvider().send(input);
  } catch (e) {
    return {
      ok: false,
      provider: "unknown",
      test: false,
      error: e instanceof Error ? e.message : "Email failed",
    };
  }
}

export type { EmailProvider, EmailResult, SendEmailInput } from "./provider";
