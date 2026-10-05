import { InputError } from "@/lib/db/errors";

/**
 * What a `useActionState` server action returns to its form: an error or a
 * notice to show, and the submitted values so the form can keep them after
 * an error (React resets uncontrolled inputs when an action finishes).
 */
export interface FormState {
  error?: string;
  notice?: string;
  values?: Record<string, string>;
}

/** The form's text fields as strings ("" when missing). */
export function formValues(formData: FormData, names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, String(formData.get(n) ?? "")]));
}

/** Turns an `InputError` into form state; rethrows anything else. */
export function inputErrorState(err: unknown, values: Record<string, string>): FormState {
  if (err instanceof InputError) return { error: err.message, values };
  throw err;
}
