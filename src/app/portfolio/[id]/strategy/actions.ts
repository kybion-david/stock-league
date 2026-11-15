"use server";

import { redirect } from "next/navigation";
import { formValues, inputErrorState, type FormState } from "@/app/_components/form-state";
import { getDb } from "@/lib/db/postgres";
import { updateStrategy } from "@/lib/strategy";

export async function editStrategyAction(
  playerId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData, ["strategy"]);
  try {
    await updateStrategy(getDb(), playerId, values.strategy);
  } catch (err) {
    return inputErrorState(err, values);
  }
  // Outside the try: redirect() works by throwing.
  redirect(`/portfolio/${playerId}`);
}
