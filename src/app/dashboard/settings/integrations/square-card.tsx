"use client";

import { useEffect, useState, useTransition } from "react";
import { listSquareLocations, setSquareLocation, disconnectSquare } from "./actions";
import { buttonClasses } from "@/components/ui/button-classes";

type Connection = {
  merchantName: string | null;
  environment: string;
  locationId: string | null;
};

export function SquareCard({
  connection,
  connectIntent,
}: {
  connection: Connection | null;
  // "connect_plan": carried through to /api/square/authorize so the OAuth
  // callback also completes the Connect-plan switch once this succeeds —
  // see api/square/callback/route.ts's connectPlanIntent.
  connectIntent?: "connect_plan";
}) {
  const [pending, start] = useTransition();
  const [locations, setLocations] = useState<{ id: string; name: string }[] | null>(null);
  const [selected, setSelected] = useState(connection?.locationId ?? "");

  useEffect(() => {
    if (!connection) return;
    listSquareLocations().then(setLocations).catch(() => setLocations([]));
  }, [connection]);

  const environmentLabel = connection?.environment === "production" ? "Production" : "Sandbox";

  return (
    <div data-tour="square" className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Square</h2>
          <p className="text-sm text-muted mt-0.5">
            {connection
              ? "Connected — this venue's Square account."
              : "Connect this venue's Square account to Tillz."}
          </p>
        </div>
        {connection && (
          <span
            className={`text-xs rounded-pill px-2.5 py-1 font-medium ${
              connection.environment === "production"
                ? "bg-pine/10 text-pine-deep"
                : "bg-warn-soft text-warn"
            }`}
          >
            {environmentLabel}
          </span>
        )}
      </div>

      {!connection ? (
        <a
          href={
            connectIntent
              ? `/api/square/authorize?intent=${connectIntent}`
              : "/api/square/authorize"
          }
          className={buttonClasses("primary", "sm", false, "mt-4")}
        >
          Connect Square
        </a>
      ) : (
        <div className="mt-4 space-y-3">
          {connection.merchantName && (
            <p className="text-sm">
              <span className="text-muted">Merchant</span>{" "}
              <span className="font-medium">{connection.merchantName}</span>
            </p>
          )}

          <div>
            <label className="text-sm text-muted block mb-1">Location</label>
            <select
              value={selected}
              disabled={pending || locations === null}
              onChange={(e) => {
                const id = e.target.value;
                setSelected(id);
                start(async () => {
                  await setSquareLocation(id);
                });
              }}
              className="w-full max-w-sm rounded-[var(--radius-md)] border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none"
            >
              <option value="" disabled>
                {locations === null ? "Loading…" : "Choose a location"}
              </option>
              {locations?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => start(async () => disconnectSquare())}
            disabled={pending}
            className="text-sm text-muted hover:text-danger"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
