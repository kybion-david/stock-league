import type { Metadata } from "next";
import { Page } from "@/app/_components/ui";

export const metadata: Metadata = { title: "Not found · Stock League" };

/** Unknown URLs and missing players, instruments or transactions. */
export default function NotFound() {
  return (
    <Page title="🤷 Not found">
      <p className="text-foreground/60">
        There&apos;s nothing here. It may have been deleted, or the link is wrong.
      </p>
    </Page>
  );
}
