"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { formValues, inputErrorState, type FormState } from "@/app/_components/form-state";
import { getDb } from "@/lib/db/postgres";
import { createPlayer, updatePlayer } from "@/lib/players";

const FIELDS = ["name", "emoji"];

export async function addPlayerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, FIELDS);
  try {
    const player = await createPlayer(getDb(), { name: values.name, emoji: values.emoji });
    refresh();
    return { notice: `Added ${player.name}.` };
  } catch (err) {
    return inputErrorState(err, values);
  }
}

export async function editPlayerAction(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData, FIELDS);
  try {
    await updatePlayer(getDb(), id, { name: values.name, emoji: values.emoji });
  } catch (err) {
    return inputErrorState(err, values);
  }
  // Outside the try: redirect() works by throwing.
  redirect("/players");
}
