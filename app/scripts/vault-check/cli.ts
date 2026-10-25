/**
 * `npm run vault:check -- <vault-dir>` (ticket 0037).
 *
 * Prints one line per finding and a summary. Exit codes: 0 clean,
 * 1 findings, 2 the path is missing or not a folder.
 */

import { statSync } from "node:fs";
import { resolve } from "node:path";
import { checkVault } from "./check.js";

const arg = process.argv[2];

if (arg == null || arg === "") {
  console.error("usage: npm run vault:check -- <vault-dir>");
  process.exit(2);
}

// npm runs this from `app/`, so resolve a relative path against the
// folder the command was typed in.
const vault = resolve(process.env.INIT_CWD ?? process.cwd(), arg);

try {
  if (!statSync(vault).isDirectory()) {
    throw new Error("not a directory");
  }
} catch (error) {
  console.error(
    `vault:check: ${vault}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(2);
}

const { notes, findings } = checkVault(vault);
for (const finding of findings) {
  console.log(
    `${finding.file}:${finding.line}: ${finding.kind}: ${finding.reason}`,
  );
}
console.log(`${notes} notes, ${findings.length} findings in ${vault}`);
process.exitCode = findings.length === 0 ? 0 : 1;
