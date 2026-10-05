"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/_components/form-state";
import { SubmitButton } from "@/app/_components/submit-button";
import { Field, FormMessage, inputClass } from "@/app/_components/ui";
import type { Instrument } from "@/lib/instruments";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Takes only a symbol: the server checks it with Yahoo and fills in the rest. */
export function AddInstrumentForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  const symbol = state.values?.symbol ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-4" key={symbol}>
      <Field
        label="Yahoo Finance symbol"
        hint="As on finance.yahoo.com: AAPL, SAP.DE, IWDA.AS, BTC-EUR. Name, type and currency are filled in from Yahoo."
      >
        <input
          name="symbol"
          defaultValue={symbol}
          required
          maxLength={32}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass} font-mono uppercase`}
        />
      </Field>
      <FormMessage error={state.error} notice={state.notice} />
      <SubmitButton pendingLabel="Checking with Yahoo…">Add instrument</SubmitButton>
    </form>
  );
}

export function EditInstrumentForm({
  action,
  instrument,
}: {
  action: Action;
  instrument: Instrument;
}) {
  const [state, formAction] = useActionState(action, {});
  const values = state.values ?? {
    name: instrument.name,
    type: instrument.type,
    currency: instrument.currency,
    exchange: instrument.exchange ?? "",
  };
  // Remount the inputs when the values change, so they show what was submitted.
  const key = JSON.stringify(values);

  return (
    <form action={formAction} className="flex flex-col gap-4" key={key}>
      <Field label="Name">
        <input name="name" defaultValue={values.name} required maxLength={100} className={inputClass} />
      </Field>
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Type">
            <select name="type" defaultValue={values.type} className={inputClass}>
              <option value="stock">Stock</option>
              <option value="etf">ETF</option>
              <option value="crypto">Crypto</option>
            </select>
          </Field>
        </div>
        <div className="w-28 shrink-0">
          <Field label="Currency">
            <input
              name="currency"
              defaultValue={values.currency}
              required
              maxLength={3}
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} font-mono`}
            />
          </Field>
        </div>
      </div>
      <Field label="Exchange" hint="Optional.">
        <input name="exchange" defaultValue={values.exchange} maxLength={100} className={inputClass} />
      </Field>
      <FormMessage error={state.error} notice={state.notice} />
      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  );
}
