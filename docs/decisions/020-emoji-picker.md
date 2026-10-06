# 020. Emoji picker: a fixed grid of our own, no library

**Status:** Accepted
**Date:** 2026-10-06

## Context

A player's emoji was a plain text input, so people had to open their
phone's emoji keyboard (or copy one from somewhere) to set it. The owner
asked for a proper picker on 2026-10-06.

## Decision

- **Our own grid, no library.** A button in the player form shows the
  current emoji and opens a scrollable grid under the form row, grouped
  (animals, faces, people, food, sport & fun, money & things, nature), with
  a "No emoji" option. Tapping one picks it and closes the grid; tapping
  outside or Escape closes it too. Component:
  `src/app/players/emoji-picker.tsx`; the list: `src/lib/emoji.ts`.
- **A curated list of about 160 emojis**, not the full Unicode set. Picker
  libraries (emoji-mart and the like) ship the whole set plus search and
  skin tones, at hundreds of KB, for a field set once per player. A short
  list also lets us leave out emojis that already mean something in the
  app (medals, the wooden spoon, the stats page's icons) and stick to
  Unicode 13 or older so every phone draws them.
- **No typed input any more.** The picker replaces the text field. The
  server still accepts any short string (`cleanPlayerInput`), so a player
  who already has an emoji outside the list keeps it until they pick
  another.

## Consequences

- No new dependency and nothing to keep up to date.
- Players can only pick from our list. If someone wants an emoji that's
  missing, add it to `EMOJI_GROUPS`; the unit test checks every entry is
  one emoji, unique, and accepted by the player form.
- No search. With about 160 emojis in a scrolling grid, it isn't needed.
