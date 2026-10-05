"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/_components/form-state";
import { SubmitButton } from "@/app/_components/submit-button";
import { Field, FormMessage, inputClass } from "@/app/_components/ui";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

const AMOUNT_HINTS: Record<string, string> = {
  buy: "What you paid for the shares. Enter broker fees separately, as a fee.",
  sell: "What you got for the shares. Enter broker fees separately, as a fee.",
  fee: "What the broker charged.",
  dividend: "What landed in your account, after tax.",
};

/**
 * Add or edit form for one transaction. Shares only show for buys and
 * sells; the instrument is optional for fees.
 */
export function TransactionForm({
  action,
  defaults,
  instruments,
  players,
  submitLabel,
  pendingLabel,
}: {
  action: Action;
  /** Field values to start from: date, type, instrumentId, shares, amount, note, by. */
  defaults: Record<string, string>;
  instruments: { id: number; symbol: string; name: string }[];
  /** Player names, for the "by" label. */
  players: string[];
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const values = state.values ?? defaults;
  // Remount the inputs when the values change, so they show what was submitted.
  const key = JSON.stringify(values);

  return (
    <form action={formAction} className="flex flex-col gap-4" key={key}>
      <Fields values={values} instruments={instruments} players={players} />
      <FormMessage error={state.error} notice={state.notice} />
      <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
    </form>
  );
}

function Fields({
  values,
  instruments,
  players,
}: {
  values: Record<string, string>;
  instruments: { id: number; symbol: string; name: string }[];
  players: string[];
}) {
  const [type, setType] = useState(values.type);
  const takesShares = type === "buy" || type === "sell";

  return (
    <>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <Field label="Type">
            <select
              name="type"
              defaultValue={values.type}
              onChange={(e) => setType(e.target.value)}
              className={inputClass}
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
              <option value="fee">Fee</option>
              <option value="dividend">Dividend</option>
            </select>
          </Field>
        </div>
        <div className="min-w-0 flex-1">
          <Field label="Date">
            <input
              type="date"
              name="date"
              defaultValue={values.date}
              required
              className={`${inputClass} min-w-0`}
            />
          </Field>
        </div>
      </div>
      <Field label={type === "fee" ? "Instrument (optional)" : "Instrument"}>
        <select name="instrumentId" defaultValue={values.instrumentId} className={inputClass}>
          <option value="">{type === "fee" ? "None" : "Pick one…"}</option>
          {instruments.map((i) => (
            <option key={i.id} value={i.id}>
              {i.symbol} · {i.name}
            </option>
          ))}
        </select>
      </Field>
      <p className="-mt-2 text-xs text-foreground/50">
        Not in the list?{" "}
        <Link href="/instruments" className="underline">
          Add it on Instruments
        </Link>
        .
      </p>
      <div className="flex gap-3">
        {takesShares && (
          <div className="min-w-0 flex-1">
            <Field label="Shares">
              <input
                name="shares"
                defaultValue={values.shares}
                required
                inputMode="decimal"
                autoComplete="off"
                placeholder="2.5"
                className={inputClass}
              />
            </Field>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Field label="Total in €">
            <input
              name="amount"
              defaultValue={values.amount}
              required
              inputMode="decimal"
              autoComplete="off"
              placeholder="250.00"
              className={inputClass}
            />
          </Field>
        </div>
      </div>
      <p className="-mt-2 text-xs text-foreground/50">{AMOUNT_HINTS[type]}</p>
      <Field label="Note" hint="Optional.">
        <input name="note" defaultValue={values.note} maxLength={200} className={inputClass} />
      </Field>
      <Field label="Entered by" hint="Saved with the change, so mistakes can be traced.">
        <select name="by" defaultValue={values.by} className={inputClass}>
          {players.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

/** Deletes a transaction after the browser's confirm dialog. */
export function DeleteTransactionForm({ action }: { action: () => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Delete this transaction for good?")) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <FormMessage error={state.error} />
      <SubmitButton pendingLabel="Deleting…" danger>
        Delete transaction
      </SubmitButton>
    </form>
  );
}
