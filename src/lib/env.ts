// Fail fast with a clear message if required env vars are missing, rather than
// surfacing a cryptic error deep in a request.
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Add it to your .env file. See .env.example.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  // "sandbox" | "production" — which Square environment to talk to.
  squareEnv: () => required("SQUARE_ENV"),
  squareApplicationId: () => required("SQUARE_APPLICATION_ID"),
  squareApplicationSecret: () => required("SQUARE_APPLICATION_SECRET"),
  squareRedirectUrl: () => required("SQUARE_REDIRECT_URL"),
  // Base64-encoded 32-byte key for AES-256-GCM token encryption (see
  // src/lib/square/crypto.ts). Never logged, never sent to the client.
  squareTokenEncKey: () => required("SQUARE_TOKEN_ENC_KEY"),
};
