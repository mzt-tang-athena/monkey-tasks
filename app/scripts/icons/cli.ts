/**
 * `npm run icons:build`. Writes the glyph table the app draws from.
 * Run it after a new glyph joins the map in `build.ts`.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFS, buildGlyphTable } from "./build.js";

const target = join(import.meta.dirname, "..", "..", "src", "components", "ui", "glyphs.ts");
writeFileSync(target, buildGlyphTable(join(import.meta.dirname, "..", "..", DEFS)));
console.log(`wrote src/components/ui/glyphs.ts`);
