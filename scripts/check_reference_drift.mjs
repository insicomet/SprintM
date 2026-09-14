import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "data/reference-manifest.json");
const artifacts = [
  "data/facade_post_catalog.csv",
  "data/frame_profile_prices.json",
  "data/horiz_ties.csv",
  "data/purlin_catalog_350.csv",
  "data/purlin_catalog_390.csv",
  "data/purlin_family_prices.json",
  "data/roofing_self_weight.json",
  "data/sandwich_panel_prices.json",
  "data/section_bank_clean.csv",
  "data/section_bank_raw.csv",
  "data/settlements-climate.json",
  "data/sv_code_mapping.json",
  "data/reference/climate.types.reference.ts",
  "src/data/deckingSpanCapacity.json",
  "src/data/facadePostCatalog.json",
  "src/data/framePGSPrices.json",
  "src/data/horizTies.json",
  "src/data/profnastilPrices.json",
  "src/data/purlinCatalog350.json",
  "src/data/purlinCatalog390.json",
  "src/data/purlinFamilyPrices.json",
  "src/data/roofingSelfWeight.json",
  "src/data/sandwichPanelPrices.json",
  "src/data/sectionBank.json",
  "src/data/settlementsClimate.json",
  "src/data/snowLadder.json",
  "src/data/svCodeMapping.json",
];

async function digest(path) {
  return createHash("sha256").update(await readFile(resolve(root, path))).digest("hex");
}

const current = Object.fromEntries(
  await Promise.all(artifacts.map(async (path) => [path, await digest(path)])),
);

if (process.argv.includes("--update")) {
  const manifest = {
    schemaVersion: 1,
    algorithm: "sha256",
    note: "Update only after reviewing regenerated reference data and Excel parity.",
    artifacts: current,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Updated ${relative(root, manifestPath)} (${artifacts.length} artifacts).`);
  process.exit(0);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const expected = manifest.artifacts ?? {};
const drift = artifacts.filter((path) => expected[path] !== current[path]);
const unexpected = Object.keys(expected).filter((path) => !artifacts.includes(path));

if (drift.length || unexpected.length) {
  console.error("Reference drift detected:");
  for (const path of drift) {
    console.error(`  ${path}: expected ${expected[path] ?? "<missing>"}, got ${current[path]}`);
  }
  for (const path of unexpected) console.error(`  ${path}: no longer registered`);
  console.error("Review the source and generated diff, verify Excel parity, then run npm run update:references.");
  process.exit(1);
}

console.log(`Reference manifest matches ${artifacts.length} artifacts.`);
