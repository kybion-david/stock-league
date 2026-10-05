"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

const SLOW_AFTER_MS = 3000;

/**
 * Submit button for a server-action form. While the action runs it is
 * disabled and shows a spinner and `pendingLabel`. After a few seconds it
 * also explains the wait: the first request after idle time wakes the SWA
 * backend and the Neon database, which can take several seconds.
 */
export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [pending]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="flex items-center justify-center gap-3 rounded-xl bg-foreground px-4 py-3 text-lg font-semibold text-background transition-opacity disabled:opacity-70"
      >
        {pending && (
          <span
            aria-hidden
            className="size-5 animate-spin rounded-full border-2 border-background/30 border-t-background"
          />
        )}
        {pending ? pendingLabel : children}
      </button>
      <p aria-live="polite" className="min-h-5 text-center text-sm text-foreground/60">
        {pending && slow ? "Waking up the server, this can take a few seconds…" : ""}
      </p>
    </div>
  );
}
