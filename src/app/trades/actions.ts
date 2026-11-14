"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { formValues, inputErrorState, type FormState } from "@/app/_components/form-state";
import { requireEditor } from "@/app/login/require-editor";
import { getDb } from "@/lib/db/postgres";
import { formatDay } from "@/lib/leaderboard";
import { setManualValue } from "@/lib/manual";
import { formatEuroCents } from "@/lib/money";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
  type TransactionForm,
} from "@/lib/transactions";

const FIELDS = ["date", "type", "instrumentId", "shares", "amount", "note", "by"];

function toInput(values: Record<string, string>): TransactionForm {
  return {
    date: values.date,
    type: values.type,
    instrumentId: values.instrumentId,
    shares: values.shares,
    amount: values.amount,
    note: values.note,
    by: values.by,
  };
}

export async function addTransactionAction(
  playerId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireEditor();
  const values = formValues(formData, FIELDS);
  try {
    const added = await createTransaction(getDb(), playerId, toInput(values));
    refresh();
    // Keep the date, type and "by" for the next entry; clear the rest.
    return {
      notice: `Added the ${added.type}${added.symbol ? ` of ${added.symbol}` : ""}.`,
      values: { ...values, instrumentId: "", shares: "", amount: "", note: "" },
    };
  } catch (err) {
    return inputErrorState(err, values);
  }
}

export async function setManualValueAction(
  playerId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireEditor();
  const values = formValues(formData, ["instrumentId", "date", "worth"]);
  try {
    const saved = await setManualValue(getDb(), playerId, {
      instrumentId: values.instrumentId,
      date: values.date,
      worth: values.worth,
    });
    refresh();
    return {
      notice: `Saved: ${saved.symbol} worth ${formatEuroCents(saved.worthCents)} on ${formatDay(saved.date)}.`,
    };
  } catch (err) {
    return inputErrorState(err, values);
  }
}

export async function editTransactionAction(
  id: number,
  playerId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireEditor();
  const values = formValues(formData, FIELDS);
  try {
    await updateTransaction(getDb(), id, toInput(values));
  } catch (err) {
    return inputErrorState(err, values);
  }
  // Outside the try: redirect() works by throwing.
  redirect(`/trades/${playerId}`);
}

export async function deleteTransactionAction(id: number, playerId: number): Promise<FormState> {
  await requireEditor();
  try {
    await deleteTransaction(getDb(), id);
  } catch (err) {
    return inputErrorState(err, {});
  }
  redirect(`/trades/${playerId}`);
}
