-- Player strategies (ticket 022): a short free-text note on how each player
-- invests, shown on their page and on /strategies. Length is checked in code.

alter table players add column strategy text;
alter table players add column strategy_updated_at timestamptz;
