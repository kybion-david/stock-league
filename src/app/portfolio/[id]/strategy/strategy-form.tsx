"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/_components/form-state";
import { SubmitButton } from "@/app/_components/submit-button";
import { Field, FormMessage, inputClass } from "@/app/_components/ui";
import { MAX_STRATEGY_LENGTH } from "@/lib/strategy";

export function StrategyForm({
  action,
  text,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  text: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const value = state.values?.strategy ?? text;

  return (
    <form action={formAction} className="flex flex-col gap-4" key={value}>
      <Field
        label="Strategy"
        hint={`Up to ${MAX_STRATEGY_LENGTH.toLocaleString("en")} characters. Everyone can read it. Leave it empty to remove it.`}
      >
        <textarea
          name="strategy"
          defaultValue={value}
          rows={8}
          maxLength={MAX_STRATEGY_LENGTH}
          placeholder="Boring world ETF and chill? All in on one stock? Buy whatever's trending on Reddit?"
          className={`${inputClass} resize-y text-base leading-relaxed`}
        />
      </Field>
      <FormMessage error={state.error} />
      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  );
}
