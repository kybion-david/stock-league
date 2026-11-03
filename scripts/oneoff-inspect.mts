// One-off, read-only: prints Gucci or Die trying's ledger and recent prices.
import { connect } from "../src/lib/db/postgres";

const db = connect(process.env.DATABASE_URL!);
try {
  const players = await db.query<{ id: number; name: string }>("select id, name from players order by id");
  console.log("PLAYERS", JSON.stringify(players));
  const target = players.filter((p) => /gucci/i.test(p.name));
  for (const p of target) {
    const txs = await db.query(
      `select t.id, t.date, t.type, i.id as iid, i.symbol, i.name as iname, i.type as itype, i.currency,
              t.shares, t.amount_cents, t.note, t.created_by, t.created_at, t.updated_by, t.updated_at
         from transactions t left join instruments i on i.id = t.instrument_id
        where t.player_id = $1 order by t.date, t.id`,
      [p.id],
    );
    console.log("PLAYER", JSON.stringify(p));
    for (const t of txs) console.log("TX", JSON.stringify(t));
    const prices = await db.query(
      `select i.symbol, s.date, s.close, s.currency from price_snapshots s join instruments i on i.id = s.instrument_id
        where s.instrument_id in (select instrument_id from transactions where player_id = $1)
        order by i.symbol, s.date`,
      [p.id],
    );
    for (const r of prices) console.log("PRICE", JSON.stringify(r));
  }
  const fx = await db.query("select date, currency, units_per_eur from fx_snapshots where date >= '2026-10-29' order by date, currency");
  for (const r of fx) console.log("FX", JSON.stringify(r));
  const totals = await db.query(
    `select p.name, t.type, count(*)::int n, sum(t.amount_cents)::int cents from transactions t join players p on p.id = t.player_id group by 1, 2 order by 1, 2`,
  );
  for (const r of totals) console.log("TOTAL", JSON.stringify(r));
} finally {
  await db.close();
}
