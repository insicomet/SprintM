import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const baseline = JSON.parse(readFileSync(resolve(here, "expected/baseline-b.json"), "utf8"));
const stdout = execFileSync(
  process.execPath,
  ["node_modules/vite-node/vite-node.mjs", "scripts/oracle/dump_project.ts", "--", JSON.stringify(baseline.inputs)],
  { cwd: root, encoding: "utf8" },
);
const actual = JSON.parse(stdout.trim().split(/\r?\n/).findLast((line) => line.startsWith("{")));
const differences = [];

function compare(path, expected, received) {
  if (typeof expected === "number" && typeof received === "number") {
    const tolerance = Math.max(0.005, Math.abs(expected) * 1e-9);
    if (Math.abs(expected - received) > tolerance) differences.push({ path, expected, received });
  } else if (expected !== received) {
    differences.push({ path, expected, received });
  }
}

for (const [key, value] of Object.entries(baseline.engine)) compare(`engine.${key}`, value, actual.sel[key]);
for (const [key, value] of Object.entries(baseline.bill)) compare(`bill.${key}`, value, actual.totals[key]);

mkdirSync(resolve(here, "work"), { recursive: true });
writeFileSync(
  resolve(here, "work/baseline-result.json"),
  `${JSON.stringify({ case: baseline.name, checkedAt: new Date().toISOString(), differences, actual }, null, 2)}\n`,
);

if (differences.length) {
  console.error(`Parity baseline failed: ${differences.length} difference(s).`);
  for (const item of differences) console.error(`  ${item.path}: Excel=${item.expected}, app=${item.received}`);
  process.exit(1);
}
console.log(
  `Parity snapshot passed: ${baseline.name}; 0 differences; status=${baseline.status ?? "unknown"}.`,
);
