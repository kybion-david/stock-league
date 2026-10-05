# 010. Market data client

**Type:** feature
**Depends on:** 002, 003

## Description

A small module wrapping the provider chosen in 002: get the closing price
of a symbol for a date, get the EUR FX rate of a currency for a date, and
check whether a symbol exists. Handle rate limits and errors cleanly. Live
calls are only allowed in an opt-in integration test; unit tests use mocks.

## Acceptance criteria

- [ ] Functions for price-on-date, FX-to-EUR-on-date, symbol lookup, covering stocks, ETFs and crypto
- [ ] Retries/backoff on rate limits; typed errors for unknown symbol / no data
- [ ] Unit tests with mocked responses; API key via env var documented in SPEC → Configuration
- [ ] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
