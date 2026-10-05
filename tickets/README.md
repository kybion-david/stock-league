# Tickets

- `backlog/`: open work, one file per ticket, named `NNN-slug.md`. Do the lowest number first.
- `done/`: finished tickets. Move the file here (`git mv`) once all acceptance criteria are met.
- New tickets: copy `TEMPLATE.md`, use the next free number.

Each ticket is sized for **one AI session**. Its "Depends on" line says what
must be in `done/` first. The milestones (what's needed before launch) are
listed in `docs/STATUS.md` → Next up.
