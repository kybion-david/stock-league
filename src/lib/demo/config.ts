/**
 * Demo season switch (ADR 020). `next.config.ts` turns it on for every Next
 * build while the demo is in the code; tests and scripts never see it.
 * Turn it off for good by reverting the demo PR.
 */
export const DEMO = process.env.STOCK_LEAGUE_DEMO === "1";

/** The pretend "today" in demo mode: a Friday, three months into the game. */
export const DEMO_TODAY = "2027-01-29";
