"use client";

import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/app/_components/ui";
import { EMOJI_GROUPS } from "@/lib/emoji";

/**
 * A button showing the player's emoji that opens a grid to pick one from,
 * so nobody has to dig through their keyboard (ADR 020). Submits the pick
 * as a hidden input called `name` ("" for none). The grid opens under the
 * nearest positioned ancestor, across its full width.
 */
export function EmojiPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // React resets the form after a successful action; follow it like a normal input.
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onReset = () => setValue(defaultValue);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;
    // Start on the current pick (or the first emoji) so keyboards can go right on.
    const grid = gridRef.current;
    const start =
      grid?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ??
      grid?.querySelector<HTMLButtonElement>("button");
    if (grid && start) {
      // Scroll only the grid (scrollIntoView would move the page too).
      grid.scrollTop = start.offsetTop - (grid.clientHeight - start.offsetHeight) / 2;
      start.focus({ preventScroll: true });
    }

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(emoji: string) {
    setValue(emoji);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={rootRef}>
      <input type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `Emoji ${value}, change` : "Pick an emoji"}
        className={`${inputClass} text-center`}
      >
        {value || <span className="opacity-40">🙂</span>}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Pick an emoji"
          className="absolute inset-x-0 top-full z-10 mt-2 rounded-2xl border border-foreground/15 bg-background shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-2">
            <span className="text-sm text-foreground/60">Pick an emoji</span>
            <button
              type="button"
              onClick={() => pick("")}
              className="rounded-lg px-2 py-1 text-sm text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
            >
              No emoji
            </button>
          </div>
          <div ref={gridRef} className="relative max-h-72 overflow-y-auto px-2 pb-2">
            {EMOJI_GROUPS.map((group) => (
              <section key={group.name} aria-label={group.name}>
                <h3 className="sticky top-0 bg-background px-2 pt-2 pb-1 text-xs text-foreground/50">
                  {group.name}
                </h3>
                <div className="grid grid-cols-8">
                  {group.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => pick(emoji)}
                      aria-pressed={emoji === value}
                      className={`aspect-square rounded-lg text-2xl hover:bg-foreground/10 ${
                        emoji === value ? "bg-foreground/15" : ""
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
