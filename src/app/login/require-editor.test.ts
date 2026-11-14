import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Viewing is public, so the password check in each server action is the only
// thing stopping a stranger from changing data (ADR 028). Guard that every
// exported action, current and future, calls requireEditor() first.
const APP_DIR = fileURLToPath(new URL("..", import.meta.url));

function actionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return actionFiles(path);
    if (!/\.tsx?$/.test(name) || name.endsWith(".test.ts")) return [];
    return /^["']use server["'];/m.test(readFileSync(path, "utf8")) ? [path] : [];
  });
}

describe("server actions", () => {
  const files = actionFiles(APP_DIR).filter((f) => !f.endsWith(join("login", "actions.ts")));

  it("finds the action files", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  it.each(files)("%s checks the password before changing anything", (file) => {
    const source = readFileSync(file, "utf8");
    const bodies = source.split(/^export async function /m).slice(1);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      const opening = body.indexOf("{\n");
      const firstLine = body.slice(opening + 2).trimStart().split("\n")[0];
      expect(firstLine, `first line of ${body.split("(")[0]}`).toBe("await requireEditor();");
    }
  });
});
