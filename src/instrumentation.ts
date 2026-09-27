import type { Instrumentation } from "next";
import { log } from "@/lib/log";

// Next calls this for EVERY server-side error — including a throw while a
// Server Component renders, which is exactly the class of failure the
// user-facing boundary (app/error.tsx) deliberately reduces to a digest.
// Without this, "Something went wrong #296983" had no readable counterpart
// anywhere: the digest reaches the user, the real message/stack did not
// reach any log a person would search. Logging the digest alongside the
// real error lets support match the two.
//
// Deliberately logs the ROUTE TEMPLATE (context.routePath, e.g.
// /staff/[slug]/kitchen) and never request.path or request.headers — paths
// carry per-table/per-receipt tokens and headers carry session cookies, and
// neither belongs in a log line.
export const onRequestError: Instrumentation.onRequestError = async (err, _request, context) => {
  const isError = err instanceof Error;
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;

  log.error("server.request_error", {
    digest,
    route: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    message: isError ? err.message : String(err),
    stack: isError ? err.stack?.slice(0, 2000) : undefined,
  });
};
