import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  layoutAllowlist,
  type LayoutAllow,
} from "./layout-numbers.allowlist";

/**
 * A layout step is a spacing or radius value at or above 4. Marks under
 * 4 stay literal, and a component may not write a raw layout number.
 * A negative value is a step too. Every exception lives in
 * layout-numbers.allowlist.ts with a reason.
 */

const app = path.resolve(import.meta.dirname, "../..");
const roots = ["src/features", "src/components", "src/app"];
const tokenFile = "src/theme/tokens.ts";

const layoutProperties = new Set([
  "padding",
  "paddingHorizontal",
  "paddingVertical",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "margin",
  "marginHorizontal",
  "marginVertical",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "gap",
  "rowGap",
  "columnGap",
  "borderRadius",
]);

type Finding = {
  file: string;
  line: number;
  column: number;
  property: string;
  value: number;
};

function keyName(name: ts.PropertyName): string | null {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  return null;
}

/** A literal number, including a typed one such as `4 as const` and a
    negated one such as `-8`. A variable, a call or arithmetic counts as
    computed and is skipped. */
function literalNumber(node: ts.Expression): number | null {
  let value = node;
  while (
    ts.isParenthesizedExpression(value) ||
    ts.isAsExpression(value) ||
    ts.isSatisfiesExpression(value) ||
    ts.isNonNullExpression(value)
  ) {
    value = value.expression;
  }
  if (
    ts.isPrefixUnaryExpression(value) &&
    (value.operator === ts.SyntaxKind.MinusToken ||
      value.operator === ts.SyntaxKind.PlusToken) &&
    ts.isNumericLiteral(value.operand)
  ) {
    const size = Number(value.operand.text);
    return value.operator === ts.SyntaxKind.MinusToken ? -size : size;
  }
  return ts.isNumericLiteral(value) ? Number(value.text) : null;
}

function findRaw(source: string, file: string): Finding[] {
  if (file === tokenFile) {
    return [];
  }
  const scriptKind = file.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const findings: Finding[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node)) {
      const property = keyName(node.name);
      const value = literalNumber(node.initializer);
      if (
        property != null &&
        layoutProperties.has(property) &&
        value != null &&
        Math.abs(value) >= 4
      ) {
        const start = parsed.getLineAndCharacterOfPosition(
          node.getStart(parsed),
        );
        findings.push({
          file,
          line: start.line + 1,
          column: start.character + 1,
          property,
          value,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return findings;
}

function sourceFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return sourceFiles(full);
      }
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) {
        return [];
      }
      // Tests do not ship, and a fixture may draw a style on purpose.
      if (/\.test\.tsx?$/.test(entry.name)) {
        return [];
      }
      return [full];
    });
}

function scan(): Finding[] {
  return roots
    .flatMap((root) => sourceFiles(path.join(app, root)))
    .flatMap((file) => {
      const relative = path.relative(app, file).split(path.sep).join("/");
      return findRaw(fs.readFileSync(file, "utf8"), relative);
    })
    .sort(
      (one, two) =>
        one.file.localeCompare(two.file) ||
        one.line - two.line ||
        one.column - two.column,
    );
}

function matches(finding: Finding, entry: LayoutAllow): boolean {
  return (
    finding.file === entry.file &&
    finding.property === entry.property &&
    finding.value === entry.value
  );
}

function report(finding: Finding): string {
  return `${finding.file}:${finding.line} sets raw ${finding.property}: ${finding.value}. Use a spacing or radius token, or allowlist it with a reason.`;
}

function valueOf(finding: Finding): string {
  return `${finding.line}:${finding.property}=${finding.value}`;
}

describe("layout number guard", () => {
  it("flags raw layout steps in features and components", () => {
    const violations = scan().filter(
      (finding) => !layoutAllowlist.some((entry) => matches(finding, entry)),
    );
    expect(violations.map(report)).toEqual([]);
  });

  it("keeps every allowlist entry live", () => {
    const findings = scan();
    for (const entry of layoutAllowlist) {
      expect(
        findings.some((finding) => matches(finding, entry)),
        `stale allowlist entry: ${entry.file} ${entry.property}: ${entry.value} (${entry.reason})`,
      ).toBe(true);
    }
  });

  it("flags a literal step and skips a computed or token value", () => {
    const fixture = [
      "const styles = {",
      "  raw: { padding: 8, gap: 6, borderRadius: 4.5 },",
      "  fine: { padding: 3, gap: 2.5 },",
      "  computed: { padding: 2 * 4, gap: spacing.s, margin: StyleSheet.hairlineWidth },",
      "  typed: { gap: 4 as number },",
      "  negative: { margin: -8 },",
      "};",
    ].join("\n");
    expect(findRaw(fixture, "fixture.tsx").map(valueOf)).toEqual([
      "2:padding=8",
      "2:gap=6",
      "2:borderRadius=4.5",
      "5:gap=4",
      "6:margin=-8",
    ]);
  });

  it("skips the token file", () => {
    const tokens = fs.readFileSync(path.join(app, tokenFile), "utf8");
    expect(findRaw(tokens, tokenFile)).toEqual([]);
  });
});
