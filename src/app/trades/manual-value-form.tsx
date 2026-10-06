"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/_components/form-state";
import { SubmitButton } from "@/app/_components/submit-button";
import { Field, FormMessage, inputClass } from "@/app/_components/ui";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** "What is it worth now?" for one manual holding (ADR 022). */
export function ManualValueForm({
  action,
  instrumentId,
  symbol,
  today,
}: {
  action: Action;
  instrumentId: number;
  symbol: string;
  today: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const values = state.values ?? { date: today, worth: "" };

  return (
    <form action={formAction} className="flex flex-col gap-2" key={JSON.stringify(values)}>
      <input type="hidden" name="instrumentId" value={instrumentId} />
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <Field label="Worth now, €">
            <input
              name="worth"
              defaultValue={values.worth}
              required
              inputMode="decimal"
              autoComplete="off"
              placeholder="150.00"
              aria-label={`What all your ${symbol} is worth, in €`}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="min-w-0 flex-1">
          <Field label="On">
            <input
              type="date"
              name="date"
              defaultValue={values.date}
              max={today}
              required
              className={`${inputClass} min-w-0`}
            />
          </Field>
        </div>
      </div>
      <FormMessage error={state.error} notice={state.notice} />
      <SubmitButton pendingLabel="Saving…">Update value</SubmitButton>
    </form>
  );
}
