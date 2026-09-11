import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Where email confirmation and password-reset links land. Supabase sends a
// one-time `code`; we exchange it for a session, then continue to `next`.
// Only allow same-site relative redirects. Reject absolute URLs and
// protocol-relative ("//evil.com", "/\evil.com") targets so `next` can't be
// used as an open redirect.
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/dashboard";
  }
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
