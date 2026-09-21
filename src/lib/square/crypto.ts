import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { env } from "@/lib/env";

// AES-256-GCM token encryption for SquareConnection.accessTokenEnc /
// refreshTokenEnc. Tokens are never returned to the client and never logged —
// this module's outputs are the only form they're allowed to exist in outside
// a live request to Square's API.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard nonce length

function getKey(): Buffer {
  const key = Buffer.from(env.squareTokenEncKey(), "base64");
  if (key.length !== 32) {
    throw new Error(
      "SQUARE_TOKEN_ENC_KEY must base64-decode to exactly 32 bytes (AES-256). Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

// Stored as base64(iv) + "." + base64(authTag) + "." + base64(ciphertext).
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptToken(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted token — expected iv.authTag.ciphertext");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
