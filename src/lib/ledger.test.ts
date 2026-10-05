import { describe, expect, it } from "vitest";
import {
  formatShares,
  parseShares,
  replay,
  STARTING_CASH_CENTS,
  validate,
  validateTransaction,
  type LedgerTransaction,
  type TransactionInput,
} from "@/lib/ledger";

let nextId = 1;
const tx = (fields: TransactionInput): LedgerTransaction => ({ id: `t${nextId++}`, ...fields });
const buy = (date: string, instrumentId: string, shares: string, amountCents: number) =>
  tx({ date, type: "buy", instrumentId, shares, amountCents });
const sell = (date: string, instrumentId: string, shares: string, amountCents: number) =>
  tx({ date, type: "sell", instrumentId, shares, amountCents });
const fee = (date: string, amountCents: number) => tx({ date, type: "fee", amountCents });
const dividend = (date: string, instrumentId: string, amountCents: number) =>
  tx({ date, type: "dividend", instrumentId, amountCents });

describe("parseShares / formatShares", () => {
  it("round-trips decimals and normalizes trailing zeros", () => {
    expect(formatShares(parseShares("1.50000000"))).toBe("1.5");
    expect(formatShares(parseShares("0.00000001"))).toBe("0.00000001");
    expect(formatShares(parseShares("12"))).toBe("12");
    expect(formatShares(parseShares("0"))).toBe("0");
    expect(formatShares(-parseShares("2.25"))).toBe("-2.25");
  });

  it("accepts trailing zeros beyond 8 places", () => {
    expect(parseShares("1.1000000000")).toBe(parseShares("1.1"));
  });

  it.each(["", "abc", "-1", "1e-7", "1.", ".5", "1,5", "0.000000001"])(
    "rejects %j",
    (value) => {
      expect(() => parseShares(value)).toThrow(TypeError);
    },
  );
});

describe("replay", () => {
  it("starts with €1,000 and no holdings", () => {
    expect(replay([], "2026-11-01")).toEqual({ cashCents: STARTING_CASH_CENTS, holdings: {} });
  });

  it("applies buys, sells, fees and dividends", () => {
    const ledger = [
      buy("2026-11-01", "AAPL", "2", 40_000),
      fee("2026-11-01", 100),
      dividend("2026-11-10", "AAPL", 250),
      sell("2026-11-12", "AAPL", "0.5", 11_000),
    ];
    expect(replay(ledger, "2026-11-12")).toEqual({
      cashCents: 100_000 - 40_000 - 100 + 250 + 11_000,
      holdings: { AAPL: "1.5" },
    });
  });

  it("includes transactions on the date and excludes later ones", () => {
    const ledger = [buy("2026-11-01", "AAPL", "1", 20_000), buy("2026-11-02", "SAP.DE", "1", 20_000)];
    expect(replay(ledger, "2026-11-01")).toEqual({ cashCents: 80_000, holdings: { AAPL: "1" } });
    expect(replay(ledger, "2026-11-02").holdings).toEqual({ AAPL: "1", "SAP.DE": "1" });
  });

  it("returns the starting state for a date before the first transaction", () => {
    const ledger = [buy("2026-11-05", "AAPL", "1", 20_000)];
    expect(replay(ledger, "2026-11-04")).toEqual({ cashCents: 100_000, holdings: {} });
  });

  it("doesn't depend on input order", () => {
    const a = buy("2026-11-01", "AAPL", "1", 20_000);
    const b = sell("2026-11-03", "AAPL", "1", 21_000);
    expect(replay([b, a], "2026-11-02")).toEqual(replay([a, b], "2026-11-02"));
  });

  it("adds fractional shares exactly and drops holdings that reach zero", () => {
    const ledger = [
      buy("2026-11-01", "BTC-EUR", "0.1", 1_000),
      buy("2026-11-02", "BTC-EUR", "0.2", 2_000),
      sell("2026-11-03", "BTC-EUR", "0.3", 3_500),
    ];
    expect(replay(ledger, "2026-11-02").holdings).toEqual({ "BTC-EUR": "0.3" });
    expect(replay(ledger, "2026-11-03")).toEqual({ cashCents: 100_500, holdings: {} });
  });

  it("computes an inconsistent ledger without throwing", () => {
    const ledger = [sell("2026-11-01", "AAPL", "1", 20_000)];
    expect(replay(ledger, "2026-11-01")).toEqual({ cashCents: 120_000, holdings: { AAPL: "-1" } });
  });
});

describe("validateTransaction", () => {
  const ok: TransactionInput = {
    date: "2026-11-01",
    type: "buy",
    instrumentId: "AAPL",
    shares: "1",
    amountCents: 100,
  };

  it("accepts well-formed transactions of every type", () => {
    expect(validateTransaction(ok)).toEqual([]);
    expect(validateTransaction({ ...ok, type: "sell" })).toEqual([]);
    expect(validateTransaction({ date: "2026-11-01", type: "fee", amountCents: 1 })).toEqual([]);
    expect(
      validateTransaction({ date: "2026-11-01", type: "dividend", instrumentId: "AAPL", amountCents: 1 }),
    ).toEqual([]);
  });

  it.each([0, -100, 1.5, Number.NaN])("rejects amount %s", (amountCents) => {
    expect(validateTransaction({ ...ok, amountCents })).toEqual([
      "Amount must be more than €0.00, in whole cents.",
    ]);
  });

  it.each(["buy", "sell", "dividend"] as const)("requires an instrument for %s", (type) => {
    const shares = type === "dividend" ? undefined : "1";
    expect(validateTransaction({ ...ok, type, shares, instrumentId: null })).toContain(
      `A ${type} needs an instrument.`,
    );
    expect(validateTransaction({ ...ok, type, shares, instrumentId: "" })).toContain(
      `A ${type} needs an instrument.`,
    );
  });

  it("rejects an instrument or shares on a fee, and shares on a dividend", () => {
    expect(validateTransaction({ ...ok, type: "fee" })).toEqual([
      "A fee doesn't take an instrument.",
      "A fee doesn't take a number of shares.",
    ]);
    expect(validateTransaction({ ...ok, type: "dividend" })).toEqual([
      "A dividend doesn't take a number of shares.",
    ]);
  });

  it("requires a positive, well-formed share count on buys and sells", () => {
    expect(validateTransaction({ ...ok, shares: null })).toEqual(["A buy needs a number of shares."]);
    expect(validateTransaction({ ...ok, shares: "0.000" })).toEqual([
      "Number of shares must be more than 0.",
    ]);
    expect(validateTransaction({ ...ok, shares: "-1" })[0]).toMatch(/positive decimal/);
    expect(validateTransaction({ ...ok, shares: "0.123456789" })[0]).toMatch(/8 decimal places/);
    expect(validateTransaction({ ...ok, shares: "0.12345678" })).toEqual([]);
  });

  it.each(["2026-11-31", "2026-02-29", "26-11-01", "2026-1-1", ""])("rejects date %j", (date) => {
    expect(validateTransaction({ ...ok, date })[0]).toMatch(/^Date must be/);
  });

  it("accepts a leap day", () => {
    expect(validateTransaction({ ...ok, date: "2028-02-29" })).toEqual([]);
  });

  it("rejects an unknown type", () => {
    expect(validateTransaction({ ...ok, type: "gift" as never })).toEqual([
      'Unknown transaction type "gift".',
    ]);
  });
});

describe("validate", () => {
  describe("cash tolerance", () => {
    it("allows spending down to exactly −€50", () => {
      const change = { kind: "create", transaction: buy("2026-11-01", "AAPL", "5", 105_000) } as const;
      expect(validate([], change)).toEqual([]);
    });

    it("rejects one cent beyond −€50", () => {
      const change = { kind: "create", transaction: buy("2026-11-01", "AAPL", "5", 105_001) } as const;
      expect(validate([], change)).toEqual([
        "On 2026-11-01 cash would be -€50.01, below the -€50.00 limit.",
      ]);
    });

    it("counts fees against the limit", () => {
      const existing = [buy("2026-11-01", "AAPL", "5", 105_000)];
      expect(validate(existing, { kind: "create", transaction: fee("2026-11-02", 1) })).toEqual([
        "On 2026-11-02 cash would be -€50.01, below the -€50.00 limit.",
      ]);
    });

    it("rejects a backdated buy that a later buy then pushes over the limit", () => {
      const existing = [buy("2026-11-10", "AAPL", "1", 100_000)];
      const change = { kind: "create", transaction: buy("2026-11-01", "SAP.DE", "1", 5_001) } as const;
      expect(validate(existing, change)).toEqual([
        "On 2026-11-10 cash would be -€50.01, below the -€50.00 limit.",
      ]);
    });

    it("rejects deleting a dividend that a later buy depends on", () => {
      const div = dividend("2026-11-05", "AAPL", 1_000);
      const existing = [buy("2026-11-01", "AAPL", "1", 50_000), div, buy("2026-11-06", "SAP.DE", "1", 56_000)];
      expect(validate(existing, { kind: "delete", id: div.id })).toEqual([
        "On 2026-11-06 cash would be -€60.00, below the -€50.00 limit.",
      ]);
    });
  });

  describe("selling", () => {
    it("allows selling exactly what's held, including fractions", () => {
      const existing = [buy("2026-11-01", "BTC-EUR", "0.1", 1_000), buy("2026-11-02", "BTC-EUR", "0.2", 2_000)];
      const change = { kind: "create", transaction: sell("2026-11-03", "BTC-EUR", "0.3", 3_000) } as const;
      expect(validate(existing, change)).toEqual([]);
    });

    it("rejects selling more than held", () => {
      const existing = [buy("2026-11-01", "BTC-EUR", "0.1", 1_000)];
      const change = { kind: "create", transaction: sell("2026-11-03", "BTC-EUR", "0.10000001", 1_000) } as const;
      expect(validate(existing, change)).toEqual([
        "On 2026-11-03 more BTC-EUR shares would be sold than held (holding would be -0.00000001).",
      ]);
    });

    it("rejects selling something never bought", () => {
      const change = { kind: "create", transaction: sell("2026-11-03", "AAPL", "1", 1_000) } as const;
      expect(validate([], change)).toEqual([
        "On 2026-11-03 more AAPL shares would be sold than held (holding would be -1).",
      ]);
    });

    it("rejects a sell dated before the buy it needs", () => {
      const existing = [buy("2026-11-05", "AAPL", "1", 20_000)];
      const change = { kind: "create", transaction: sell("2026-11-04", "AAPL", "1", 20_000) } as const;
      expect(validate(existing, change)).toEqual([
        "On 2026-11-04 more AAPL shares would be sold than held (holding would be -1).",
      ]);
    });

    it("rejects deleting a buy that a later sell depends on", () => {
      const b = buy("2026-11-01", "AAPL", "1", 20_000);
      const existing = [b, sell("2026-11-08", "AAPL", "1", 22_000)];
      expect(validate(existing, { kind: "delete", id: b.id })).toEqual([
        "On 2026-11-08 more AAPL shares would be sold than held (holding would be -1).",
      ]);
    });

    it("rejects editing a buy to a date after the sell that depends on it", () => {
      const b = buy("2026-11-01", "AAPL", "1", 20_000);
      const existing = [b, sell("2026-11-08", "AAPL", "1", 22_000)];
      const change = { kind: "update", id: b.id, transaction: { ...b, date: "2026-11-09" } } as const;
      expect(validate(existing, change)).toEqual([
        "On 2026-11-08 more AAPL shares would be sold than held (holding would be -1).",
      ]);
    });

    it("rejects editing a buy down to fewer shares than were later sold", () => {
      const b = buy("2026-11-01", "AAPL", "2", 40_000);
      const existing = [b, sell("2026-11-08", "AAPL", "2", 42_000)];
      const change = { kind: "update", id: b.id, transaction: { ...b, shares: "1.5" } } as const;
      expect(validate(existing, change)).toEqual([
        "On 2026-11-08 more AAPL shares would be sold than held (holding would be -0.5).",
      ]);
    });

    it("tracks instruments separately", () => {
      const existing = [buy("2026-11-01", "AAPL", "1", 20_000)];
      const change = { kind: "create", transaction: sell("2026-11-02", "SAP.DE", "1", 20_000) } as const;
      expect(validate(existing, change)).toHaveLength(1);
    });
  });

  describe("same-day transactions are checked at the end of the day", () => {
    it("allows a same-day sell entered after the buy", () => {
      const existing = [buy("2026-11-02", "AAPL", "1", 20_000)];
      const change = { kind: "create", transaction: sell("2026-11-02", "AAPL", "1", 20_500) } as const;
      expect(validate(existing, change)).toEqual([]);
    });

    it("allows a same-day buy entered after the sell", () => {
      const existing = [sell("2026-11-02", "AAPL", "1", 20_500)];
      const change = { kind: "create", transaction: buy("2026-11-02", "AAPL", "1", 20_000) } as const;
      expect(validate(existing, change)).toEqual([]);
    });

    it("allows rebalancing whose buy would overdraw cash before the same-day sell", () => {
      const existing = [buy("2026-11-01", "AAPL", "4", 100_000)];
      const rebalance = [buy("2026-11-02", "SAP.DE", "4", 100_000)];
      const change = { kind: "create", transaction: sell("2026-11-02", "AAPL", "4", 100_000) } as const;
      expect(validate([...existing, ...rebalance], change)).toEqual([]);
    });
  });

  describe("change handling", () => {
    it("allows an edit that fixes the amount", () => {
      const b = buy("2026-11-01", "AAPL", "1", 20_000);
      const change = { kind: "update", id: b.id, transaction: { ...b, amountCents: 21_000 } } as const;
      expect(validate([b], change)).toEqual([]);
    });

    it("re-checks the replaced transaction, not the old one", () => {
      const b = buy("2026-11-01", "AAPL", "1", 20_000);
      const change = { kind: "update", id: b.id, transaction: { ...b, amountCents: 106_000 } } as const;
      expect(validate([b], change)).toEqual([
        "On 2026-11-01 cash would be -€60.00, below the -€50.00 limit.",
      ]);
    });

    it("returns field errors before checking the ledger", () => {
      const change = { kind: "create", transaction: { ...buy("2026-11-01", "AAPL", "1", 0) } } as const;
      expect(validate([], change)).toEqual(["Amount must be more than €0.00, in whole cents."]);
    });

    it.each(["update", "delete"] as const)("rejects %s of an unknown id", (kind) => {
      const change =
        kind === "delete"
          ? ({ kind, id: "nope" } as const)
          : ({ kind, id: "nope", transaction: fee("2026-11-01", 1) } as const);
      expect(validate([], change)).toEqual(["Transaction nope doesn't exist."]);
    });

    it("allows deleting a sell", () => {
      const s = sell("2026-11-02", "AAPL", "1", 20_000);
      expect(validate([buy("2026-11-01", "AAPL", "1", 20_000), s], { kind: "delete", id: s.id })).toEqual([]);
    });

    it("allows a dividend on an instrument no longer held", () => {
      const existing = [buy("2026-11-01", "AAPL", "1", 20_000), sell("2026-11-02", "AAPL", "1", 20_000)];
      const change = { kind: "create", transaction: dividend("2026-11-20", "AAPL", 50) } as const;
      expect(validate(existing, change)).toEqual([]);
    });

    it("reports both rules when both break", () => {
      const change = { kind: "create", transaction: sell("2026-11-01", "AAPL", "1", 1) } as const;
      const existing = [fee("2026-11-01", 105_002)];
      expect(validate(existing, change)).toEqual([
        "On 2026-11-01 cash would be -€50.01, below the -€50.00 limit.",
        "On 2026-11-01 more AAPL shares would be sold than held (holding would be -1).",
      ]);
    });
  });
});
