"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { formValues, inputErrorState, type FormState } from "@/app/_components/form-state";
import { getDb } from "@/lib/db/postgres";
import { addInstrument, addManualInstrument, updateInstrument } from "@/lib/instruments";
import { createMarketDataClient } from "@/lib/market-data";

export async function addInstrumentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData, ["symbol"]);
  try {
    const added = await addInstrument(getDb(), createMarketDataClient(), values.symbol);
    refresh();
    return { notice: `Added ${added.symbol} (${added.name}).` };
  } catch (err) {
    return inputErrorState(err, values);
  }
}

export async function addManualInstrumentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData, ["name"]);
  try {
    const added = await addManualInstrument(getDb(), values.name);
    refresh();
    return { notice: `Added ${added.symbol}. Now enter the buy on your trades page.` };
  } catch (err) {
    return inputErrorState(err, values);
  }
}

export async function editInstrumentAction(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData, ["name", "type", "currency", "exchange"]);
  try {
    await updateInstrument(getDb(), id, {
      name: values.name,
      type: values.type,
      currency: values.currency,
      exchange: values.exchange,
    });
  } catch (err) {
    return inputErrorState(err, values);
  }
  // Outside the try: redirect() works by throwing.
  redirect("/instruments");
}
