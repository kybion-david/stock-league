# Stock League

A just-for-fun investment game for a group of friends. The code is open
source (MIT); the game itself and its data stay private behind a shared
password.

Each player (5–7 people) invests **€1,000** at the start of November 2026 and
records how they split it — e.g. €200 in Apple, €300 in Google, €3 in fees.
The app pulls market prices daily and shows a dashboard/leaderboard so
everyone can see how they're doing compared to each other.

> This project is built entirely by AI agents. If you are one, start with
> [`AGENTS.md`](AGENTS.md).

## Where things are

| Doc | What it holds |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | What we're building: game rules, features, tech stack |
| [`docs/STATUS.md`](docs/STATUS.md) | What's true right now and what's next |
| [`docs/decisions/`](docs/decisions/) | Why things are the way they are (ADRs) |
| [`tickets/`](tickets/) | Backlog of work |

## Running locally

Needs Node 22 (`nvm use`).

```sh
npm install
cp .env.example .env   # set SITE_PASSWORD (anything), and DATABASE_URL to your own dev database
npm run db:migrate
npm run db:seed        # optional fake players and trades
npm run dev            # http://localhost:3000
npm run ingest         # optional: fetch today's prices for held instruments
```

No database yet? `CONTRIBUTING.md` has a one-line Docker Postgres. Never
point `DATABASE_URL` at the real game's database.

Tests don't need a database: they use an in-memory Postgres (PGlite). They
don't call market-data APIs either; `npm run test:live` does.

Checks: `npm run lint`, `npm run typecheck`, `npm test`. The full command list
is in [`docs/SPEC.md`](docs/SPEC.md) → Commands, including how deploys work
(every merge to `main` goes live). The live URL and the current state are in
[`docs/STATUS.md`](docs/STATUS.md).

## Contributing

Friends (and anyone else) are welcome to send pull requests. See
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[MIT](LICENSE)
