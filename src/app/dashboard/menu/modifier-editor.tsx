"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createModifierGroup,
  deleteModifierGroup,
  createModifierOption,
  deleteModifierOption,
} from "./actions";
import { formatCents } from "@/lib/money";

export type ModOption = { id: string; name: string; priceDeltaCents: number };
export type ModGroup = {
  id: string;
  name: string;
  required: boolean;
  maxSelect: number;
  options: ModOption[];
};

export function ModifierEditor({
  itemId,
  currency,
  groups,
}: {
  itemId: string;
  currency: string;
  groups: ModGroup[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [gName, setGName] = useState("");
  const [gRequired, setGRequired] = useState(false);
  const [gMax, setGMax] = useState(1);

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function addGroup() {
    if (!gName.trim()) return;
    run(async () => {
      const res = await createModifierGroup({
        itemId,
        name: gName,
        required: gRequired,
        maxSelect: gMax,
      });
      if (!res.error) {
        setGName("");
        setGRequired(false);
        setGMax(1);
      }
      return res;
    });
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-pine hover:underline"
      >
        {open ? "Hide options" : `Options${groups.length ? ` (${groups.length})` : ""}`}
      </button>

      {open && (
        <div className="mt-3 rounded-lg bg-paper p-3 space-y-3">
          {groups.map((g) => (
            <GroupBlock
              key={g.id}
              group={g}
              currency={currency}
              onRun={run}
              pending={pending}
            />
          ))}

          <div className="rounded-lg border border-line bg-surface p-3">
            <p className="text-xs font-medium text-muted mb-2">Add an option group</p>
            <div className="flex flex-wrap items-end gap-2">
              <input
                value={gName}
                onChange={(e) => setGName(e.target.value)}
                placeholder="Sauce"
                className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm w-32"
              />
              <label className="flex items-center gap-1 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={gRequired}
                  onChange={(e) => setGRequired(e.target.checked)}
                  className="accent-pine"
                />
                Required
              </label>
              <label className="flex items-center gap-1 text-xs text-muted">
                Max
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={gMax}
                  onChange={(e) => setGMax(Number(e.target.value))}
                  className="rounded-md border border-line bg-surface px-2 py-1 text-sm w-14"
                />
              </label>
              <button
                onClick={addGroup}
                disabled={pending}
                className="rounded-md bg-ink text-surface px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Add group
              </button>
            </div>
            <p className="text-[11px] text-muted mt-2">
              Max 1 = single choice (e.g. sauce). Higher = pick several (e.g.
              extras). 0 = unlimited.
            </p>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}

function GroupBlock({
  group,
  currency,
  onRun,
  pending,
}: {
  group: ModGroup;
  currency: string;
  onRun: (fn: () => Promise<{ error?: string }>) => void;
  pending: boolean;
}) {
  const [oName, setOName] = useState("");
  const [oPrice, setOPrice] = useState("");

  function addOption() {
    if (!oName.trim()) return;
    onRun(async () => {
      const res = await createModifierOption({
        groupId: group.id,
        name: oName,
        price: oPrice,
      });
      if (!res.error) {
        setOName("");
        setOPrice("");
      }
      return res;
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          {group.name}
          <span className="text-xs text-muted font-normal">
            {" "}
            · {group.required ? "required" : "optional"}
            {group.maxSelect === 1
              ? " · single"
              : group.maxSelect === 0
                ? " · unlimited"
                : ` · up to ${group.maxSelect}`}
          </span>
        </span>
        <button
          onClick={() => onRun(() => deleteModifierGroup(group.id))}
          disabled={pending}
          className="text-xs text-muted hover:text-danger disabled:opacity-50"
        >
          Delete group
        </button>
      </div>

      {group.options.length > 0 && (
        <ul className="space-y-1 mb-2">
          {group.options.map((o) => (
            <li key={o.id} className="flex items-center justify-between text-sm">
              <span>
                {o.name}
                {o.priceDeltaCents > 0 && (
                  <span className="text-muted">
                    {" "}
                    +{formatCents(o.priceDeltaCents, currency)}
                  </span>
                )}
              </span>
              <button
                onClick={() => onRun(() => deleteModifierOption(o.id))}
                disabled={pending}
                className="text-xs text-muted hover:text-danger disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <input
          value={oName}
          onChange={(e) => setOName(e.target.value)}
          placeholder="BBQ"
          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm flex-1"
        />
        <input
          value={oPrice}
          onChange={(e) => setOPrice(e.target.value)}
          placeholder="+$ (blank = free)"
          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm w-32"
        />
        <button
          onClick={addOption}
          disabled={pending}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink/30 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
