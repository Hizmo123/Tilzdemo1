import { NextResponse } from "next/server";
import { getAuthz } from "@/lib/auth";
import { menuImportTemplateCsv } from "@/lib/menu-import";

export async function GET() {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(menuImportTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tillz-menu-import-template.csv"`,
    },
  });
}
