-- Initial schema: players, instruments, the transaction ledger, and daily
-- price and FX snapshots. See docs/SPEC.md → Data model.

create table players (
  id integer generated always as identity primary key,
  name text not null unique check (btrim(name) <> ''),
  emoji text,
  created_at timestamptz not null default now()
);

create table instruments (
  id integer generated always as identity primary key,
  -- Yahoo Finance symbol, e.g. AAPL, SAP.DE, BTC-EUR.
  symbol text not null unique check (btrim(symbol) <> ''),
  name text not null,
  type text not null check (type in ('stock', 'etf', 'crypto')),
  -- As Yahoo reports it. Usually ISO 4217, but London listings use GBp (pence).
  currency text not null check (currency ~ '^[A-Za-z]{3}$'),
  exchange text,
  created_at timestamptz not null default now()
);

create table transactions (
  id integer generated always as identity primary key,
  player_id integer not null references players (id),
  -- Game day (Europe/Berlin).
  date date not null,
  type text not null check (type in ('buy', 'sell', 'fee', 'dividend')),
  instrument_id integer references instruments (id),
  -- Exact decimal, at most 8 significant decimal places (SHARE_DECIMALS in
  -- src/lib/ledger.ts). More is rejected rather than rounded; trailing zeros are fine.
  shares numeric check (shares > 0 and shares = round(shares, 8)),
  -- What the broker charged or paid, in euro cents. Direction comes from type.
  amount_cents integer not null check (amount_cents > 0),
  note text,
  created_at timestamptz not null default now(),
  created_by text not null,
  updated_at timestamptz not null default now(),
  updated_by text not null,
  check (case type
    when 'buy' then instrument_id is not null and shares is not null
    when 'sell' then instrument_id is not null and shares is not null
    when 'dividend' then instrument_id is not null and shares is null
    when 'fee' then shares is null
  end)
);

create index transactions_player_date on transactions (player_id, date);

create table price_snapshots (
  instrument_id integer not null references instruments (id),
  date date not null,
  -- Close in the instrument's own currency (not cents; exact decimal).
  close numeric not null check (close > 0),
  currency text not null check (currency ~ '^[A-Za-z]{3}$'),
  fetched_at timestamptz not null default now(),
  primary key (instrument_id, date)
);

create table fx_snapshots (
  date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$' and currency <> 'EUR'),
  -- ECB quote with base EUR: 1 EUR = units_per_eur units of currency.
  -- EUR value = amount / units_per_eur.
  units_per_eur numeric not null check (units_per_eur > 0),
  fetched_at timestamptz not null default now(),
  primary key (date, currency)
);
