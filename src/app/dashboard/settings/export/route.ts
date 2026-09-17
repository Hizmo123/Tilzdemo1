import { NextResponse } from "next/server";
import { getAuthz } from "@/lib/auth";
import { exportOrganizationData } from "@/lib/account";

export async function GET() {
  const authz = await getAuthz();
  if (!authz.can("settings:manage")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const organizationId = authz.membership?.organizationId;
  if (!organizationId) return new NextResponse("Not found", { status: 404 });

  const data = await exportOrganizationData(organizationId);
  const json = JSON.stringify(data, null, 2);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tillz-account-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
