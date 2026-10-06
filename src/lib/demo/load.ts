import type { Db } from "@/lib/db/db";
import type { DemoSeason } from "./season";

/**
 * Writes a demo season into an empty, migrated database. Rows go in a few
 * bulk statements (`unnest` of arrays), so a cold start stays quick.
 */
export async function loadSeason(db: Db, season: DemoSeason): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(
      `insert into players (name, emoji, created_at)
       select name, emoji, '2026-10-20T18:00:00Z' from unnest($1::text[], $2::text[]) as t(name, emoji)`,
      [season.players.map((p) => p.name), season.players.map((p) => p.emoji)],
    );
    const i = season.instruments;
    await tx.query(
      `insert into instruments (symbol, name, type, currency, exchange, created_at)
       select *, '2026-10-25T18:00:00Z'::timestamptz
       from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])`,
      [i.map((x) => x.symbol), i.map((x) => x.name), i.map((x) => x.type), i.map((x) => x.currency), i.map((x) => x.exchange)],
    );
    const t = season.transactions;
    // Entered by the player the evening of the trade; ordinality keeps the
    // script's order within a day.
    await tx.query(
      `insert into transactions
         (player_id, date, type, instrument_id, shares, amount_cents, note,
          created_at, created_by, updated_at, updated_by)
       select p.id, t.date, t.type, i.id, t.shares, t.amount_cents, t.note,
         (t.date + time '19:00' + t.n * interval '1 minute') at time zone 'Europe/Berlin', p.name,
         (t.date + time '19:00' + t.n * interval '1 minute') at time zone 'Europe/Berlin', p.name
       from unnest($1::text[], $2::date[], $3::text[], $4::text[], $5::numeric[], $6::int[], $7::text[])
         with ordinality as t(player, date, type, symbol, shares, amount_cents, note, n)
       join players p on p.name = t.player
       left join instruments i on i.symbol = t.symbol
       order by t.n`,
      [
        t.map((x) => x.player),
        t.map((x) => x.date),
        t.map((x) => x.type),
        t.map((x) => x.symbol),
        t.map((x) => x.shares),
        t.map((x) => x.amountCents),
        t.map((x) => x.note),
      ],
    );
    const p = season.prices;
    await tx.query(
      `insert into price_snapshots (instrument_id, date, close, currency, fetched_at)
       select i.id, p.date, p.close, p.currency, p.date + time '22:30' at time zone 'UTC'
       from unnest($1::text[], $2::date[], $3::numeric[], $4::text[]) as p(symbol, date, close, currency)
       join instruments i on i.symbol = p.symbol`,
      [p.map((x) => x.symbol), p.map((x) => x.date), p.map((x) => x.close), p.map((x) => x.currency)],
    );
    const f = season.fx;
    await tx.query(
      `insert into fx_snapshots (date, currency, units_per_eur, fetched_at)
       select date, currency, units_per_eur, date + time '22:30' at time zone 'UTC'
       from unnest($1::date[], $2::text[], $3::numeric[]) as f(date, currency, units_per_eur)`,
      [f.map((x) => x.date), f.map((x) => x.currency), f.map((x) => x.unitsPerEur)],
    );
  });
}
