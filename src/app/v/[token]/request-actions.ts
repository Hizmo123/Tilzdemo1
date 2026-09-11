"use server";

import { createCustomerRequest } from "@/lib/requests";

// One-tap "call staff" — just notifies the floor that this table needs
// attention. No reason needed (spec: simple assistance flag).
export async function callStaff(token: string) {
  return createCustomerRequest(token, "ASSISTANCE");
}
