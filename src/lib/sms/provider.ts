// Provider-agnostic SMS abstraction — same shape as the payments abstraction.
// The app depends only on this interface; a mock runs in dev and Twilio (or any
// other provider) drops in behind it without touching call sites.

export type SmsResult = {
  ok: boolean;
  provider: string;
  test: boolean; // true = nothing really sent (mock)
  // In test mode we surface the message so dev flows (e.g. OTP) are usable
  // without a real SMS gateway. Never populated by a real provider.
  devBody?: string;
  error?: string;
};

export interface SmsProvider {
  readonly name: string;
  readonly isTest: boolean;
  send(to: string, body: string): Promise<SmsResult>;
}
