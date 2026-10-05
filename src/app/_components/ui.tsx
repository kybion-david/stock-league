import Link from "next/link";

/** Shared input styling, matching the login page. */
export const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-transparent px-4 py-3 text-lg";

/** Page wrapper with a back link and a title, sized for phones first. */
export function Page({
  title,
  back = { href: "/", label: "Home" },
  children,
}: {
  title: string;
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <Link href={back.href} className="text-sm text-foreground/60 hover:text-foreground">
        ← {back.label}
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {children}
    </main>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-foreground/60">{label}</span>
      {children}
      {hint && <span className="text-xs text-foreground/50">{hint}</span>}
    </label>
  );
}

/** The error or notice a server action returned. */
export function FormMessage({ error, notice }: { error?: string; notice?: string }) {
  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p role="status" className="text-sm text-green-700 dark:text-green-400">
        {notice}
      </p>
    );
  }
  return null;
}
