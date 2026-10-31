/**
 * `npm run sample:build` (ticket 0051). Writes the sample index from
 * the sample notes. Run it after a change to a sample note.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { SAMPLE_DIR, buildSampleIndex } from "./build.js";

// The sample folder sits under `app/`, two folders up from here.
const sampleDir = join(import.meta.dirname, "..", "..", SAMPLE_DIR);
const target = join(sampleDir, "index.ts");
writeFileSync(target, buildSampleIndex(sampleDir));
console.log(`wrote ${join(SAMPLE_DIR, "index.ts")}`);
