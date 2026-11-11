/**
 * Writes the preview's sample vault to a folder, with every date moved
 * so the sample day lands on the given day. android-launch.sh pushes
 * that folder to the emulator. It uses the preview's seeds and shift,
 * so both surfaces show the same groups.
 *
 * Usage: tsx android-seed.ts <out dir> <YYYY-MM-DD> [seed,seed]
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  PREVIEW_SEEDS,
  sampleSeed,
} from "../../../../app/src/lib/vault/sample/seed";

const [out, today, seeds] = process.argv.slice(2);
if (out == null || !/^\d{4}-\d{2}-\d{2}$/.test(today ?? "")) {
  console.error("usage: android-seed.ts <out dir> <YYYY-MM-DD> [seeds]");
  process.exit(2);
}
const names = seeds ? seeds.split(",") : PREVIEW_SEEDS;
rmSync(out, { recursive: true, force: true });
const files = sampleSeed(names, today);
for (const [path, text] of Object.entries(files)) {
  const target = join(out, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}
console.log(
  `seeded ${Object.keys(files).length} notes for ${today} (${names.join(",")})`,
);
