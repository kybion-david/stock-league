-- Manual instruments (ADR 022): things with no market price, such as an
-- options trade, whose value players type in themselves. Their "price"
-- rows are entered by hand, never fetched, and can be 0 (expired worthless).

alter table instruments drop constraint instruments_type_check;
alter table instruments add constraint instruments_type_check
  check (type in ('stock', 'etf', 'crypto', 'manual'));

alter table price_snapshots drop constraint price_snapshots_close_check;
alter table price_snapshots add constraint price_snapshots_close_check
  check (close >= 0);
