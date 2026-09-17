import { randomInt, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";

const CODE_LENGTH = 6;
const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
// Without this, sendOtp had no limit at all — an attacker (or a buggy retry
// loop) could spam SMS to any phone number indefinitely, which is both a real
// cost (each real send bills the Twilio account) and a harassment vector
// against whoever owns that number.
const RESEND_COOLDOWN_SECONDS = 45;
const MAX_SENDS_PER_HOUR = 5;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += randomInt(0, 10).toString();
  return code;
}

function hashCode(code: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(code, salt, 32).toString("hex");
  return `${salt}$${hash}`;
}

function checkCode(code: string, stored: string): boolean {
  const [salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const test = scryptSync(code, salt, 32);
  const known = Buffer.from(hash, "hex");
  return test.length === known.length && timingSafeEqual(test, known);
}

// Create a challenge and text the code. In dev/mock mode the code is returned as
// `devCode` so the flow is testable without a real SMS gateway.
export async function sendOtp(
  phoneE164: string,
  purpose = "owner_verify",
): Promise<{ ok: true; devCode?: string } | { error: string }> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [mostRecent, sentThisHour] = await Promise.all([
    prisma.otpChallenge.findFirst({
      where: { phone: phoneE164, purpose },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.otpChallenge.count({
      where: { phone: phoneE164, purpose, createdAt: { gte: hourAgo } },
    }),
  ]);
  if (mostRecent && Date.now() - mostRecent.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    return { error: "Please wait before requesting another code." };
  }
  if (sentThisHour >= MAX_SENDS_PER_HOUR) {
    return { error: "Too many codes requested for this number. Try again later." };
  }

  const code = generateCode();
  await prisma.otpChallenge.create({
    data: {
      phone: phoneE164,
      purpose,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000),
    },
  });

  const res = await sendSms(
    phoneE164,
    `Your Tillz verification code is ${code}. It expires in ${TTL_MINUTES} minutes.`,
  );
  if (!res.ok && !res.test) return { error: "Couldn't send the code. Check the number." };
  return { ok: true, devCode: res.test ? code : undefined };
}

// Verify the latest un-consumed code for a phone.
export async function verifyOtp(
  phoneE164: string,
  code: string,
  purpose = "owner_verify",
): Promise<{ ok: true } | { error: string }> {
  const ch = await prisma.otpChallenge.findFirst({
    where: { phone: phoneE164, purpose, consumed: false },
    orderBy: { createdAt: "desc" },
  });
  if (!ch) return { error: "Request a code first." };
  if (ch.expiresAt < new Date())
    return { error: "That code has expired — send a new one." };
  if (ch.attempts >= MAX_ATTEMPTS)
    return { error: "Too many attempts — send a new code." };

  if (!checkCode(code.trim(), ch.codeHash)) {
    await prisma.otpChallenge.update({
      where: { id: ch.id },
      data: { attempts: { increment: 1 } },
    });
    return { error: "Incorrect code." };
  }

  await prisma.otpChallenge.update({
    where: { id: ch.id },
    data: { consumed: true },
  });
  return { ok: true };
}
