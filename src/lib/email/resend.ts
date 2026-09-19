import type { EmailProvider, EmailResult, SendEmailInput } from "./provider";

// Resend's REST API (no SDK needed — a single authenticated POST). Requires
// RESEND_API_KEY and RESEND_FROM (a verified sender address, e.g.
// "Tillz <receipts@yourdomain.com>").
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  readonly isTest = false;

  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send(input: SendEmailInput): Promise<EmailResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return {
          ok: false,
          provider: "resend",
          test: false,
          error: `Resend ${res.status}: ${detail.slice(0, 200)}`,
        };
      }
      return { ok: true, provider: "resend", test: false };
    } catch (e) {
      return {
        ok: false,
        provider: "resend",
        test: false,
        error: e instanceof Error ? e.message : "Email send failed",
      };
    }
  }
}
