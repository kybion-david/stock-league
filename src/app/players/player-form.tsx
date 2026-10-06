"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/_components/form-state";
import { SubmitButton } from "@/app/_components/submit-button";
import { Field, FormMessage, inputClass } from "@/app/_components/ui";
import { EmojiPicker } from "./emoji-picker";

/** Add or edit form for a player; `player` pre-fills it when editing. */
export function PlayerForm({
  action,
  player,
  submitLabel,
  pendingLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  player?: { name: string; emoji: string | null };
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const values = state.values ?? { name: player?.name ?? "", emoji: player?.emoji ?? "" };
  // Remount the inputs when the values change, so they show what was submitted.
  const key = JSON.stringify(values);

  return (
    <form action={formAction} className="flex flex-col gap-4" key={key}>
      {/* `relative`: the emoji grid opens under this whole row. */}
      <div className="relative flex gap-3">
        {/* Not a <Field>: a <label> would pass taps on the open grid to the button. */}
        <div className="flex w-20 shrink-0 flex-col gap-2">
          <span className="text-sm text-foreground/60">Emoji</span>
          <EmojiPicker name="emoji" defaultValue={values.emoji} />
        </div>
        <div className="min-w-0 flex-1">
          <Field label="Name">
            <input
              name="name"
              defaultValue={values.name}
              required
              maxLength={40}
              autoComplete="off"
              className={inputClass}
            />
          </Field>
        </div>
      </div>
      <FormMessage error={state.error} notice={state.notice} />
      <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
    </form>
  );
}
