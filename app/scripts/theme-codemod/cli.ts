import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * Ticket 0083's lever. A palette baked in at module load cannot
 * repaint, so every colored style sheet becomes a factory and its
 * component reads it through `useThemedStyles`.
 *
 * The rewrite is textual: it moves each `StyleSheet.create` call into
 * `makeStyles(colors)`, drops the module `colors` import, and inserts
 * one hook call per component that reads the sheet. Files with no
 * colored sheet are left alone.
 *
 * Run from `app/`: `npx tsx scripts/theme-codemod/cli.ts`.
 */

const root = path.resolve(import.meta.dirname, "../..");
const src = path.join(root, "src");

/** Import the hook from here, and the palette type from the tokens. */
const hookImport = 'import { useThemedStyles } from "@/theme/theme-provider";';
const tokensModule = "@/theme/tokens";

type Edit = { start: number; end: number; text: string };

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const rel = path.relative(src, full);
      return entry.name === "testing" || rel.endsWith("lib/vault/sample")
        ? []
        : walk(full);
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) {
      return [];
    }
    return [full];
  });
}

function isStyleSheetCreate(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.expression.getText() === "StyleSheet" &&
    node.expression.name.text === "create"
  );
}

/** The top-level `const <name> = StyleSheet.create(...)` statements. */
function sheetStatements(source: ts.SourceFile) {
  return source.statements.flatMap((statement) => {
    if (!ts.isVariableStatement(statement)) {
      return [];
    }
    const declaration = statement.declarationList.declarations.find(
      (item) => ts.isIdentifier(item.name) && item.initializer != null && isStyleSheetCreate(item.initializer),
    );
    if (declaration == null || !ts.isIdentifier(declaration.name)) {
      return [];
    }
    return [{ statement, name: declaration.name.text, init: declaration.initializer as ts.CallExpression }];
  });
}

function hasName(node: ts.Node): node is ts.FunctionDeclaration & { name: ts.Identifier } {
  return ts.isFunctionDeclaration(node) && node.name != null && /^[A-Z]/.test(node.name.text);
}

type Component =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction;

/** Every component function: top-level, nested, or the body of memo(). */
function components(source: ts.SourceFile): Component[] {
  const found: Component[] = [];
  const visit = (node: ts.Node) => {
    if (hasName(node)) {
      found.push(node);
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !/^[A-Z]/.test(declaration.name.text)) {
          continue;
        }
        const init = declaration.initializer;
        if (init == null) {
          continue;
        }
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          found.push(init);
        } else if (ts.isCallExpression(init)) {
          const called = init.expression.getText();
          const inner = init.arguments[0];
          if (/\.memo$|^memo$/.test(called) && inner != null && (ts.isArrowFunction(inner) || ts.isFunctionExpression(inner))) {
            found.push(inner);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/**
 * Identifiers a function reads, including inline callbacks such as a
 * worklet or a style prop. A nested component reads its own sheet, so
 * the scan skips every other component in the file.
 */
function ownIdentifiers(fn: Component, skip: Set<ts.Node>): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node) => {
    if (node !== fn && skip.has(node)) {
      return;
    }
    if (ts.isIdentifier(node)) {
      names.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  if (fn.body != null) {
    visit(fn.body);
  }
  return names;
}

function indentOf(text: string, position: number): string {
  const lineStart = text.lastIndexOf("\n", position) + 1;
  return text.slice(lineStart, position).match(/^\s*/)?.[0] ?? "";
}

/** Rebuild the tokens import without `colors`, with the palette type. */
function rewriteTokensImport(
  source: ts.SourceFile,
  text: string,
): { edit: Edit; at: number } | null {
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.getText(source) !== `"${tokensModule}"`) {
      continue;
    }
    const clause = statement.importClause;
    if (clause?.namedBindings == null || !ts.isNamedImports(clause.namedBindings)) {
      continue;
    }
    const kept = clause.namedBindings.elements
      .map((element) => element.getText(source))
      .filter((name) => name !== "colors");
    kept.push("type Palette");
    const replacement = `import { ${kept.join(", ")} } from "${tokensModule}";`;
    return {
      edit: { start: statement.getStart(source), end: statement.getEnd(), text: replacement },
      at: statement.getEnd(),
    };
  }
  return null;
}

function convert(file: string): "converted" | "skipped" | "hand" {
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const sheets = sheetStatements(source).filter((sheet) => sheet.init.getText(source).includes("colors."));
  if (sheets.length === 0) {
    return "skipped";
  }

  const sheetNames = new Set(sheets.map((sheet) => sheet.name));
  const all = components(source);
  const componentsInFile = new Set<ts.Node>(all);
  const targets = all.filter((fn) => {
    const names = ownIdentifiers(fn, componentsInFile);
    return [...sheetNames].some((name) => names.has(name));
  });
  if (targets.length === 0) {
    return "hand";
  }

  const edits: Edit[] = [];
  const importRewrite = rewriteTokensImport(source, text);
  if (importRewrite == null) {
    return "hand";
  }
  edits.push(importRewrite.edit);
  edits.push({ start: importRewrite.at, end: importRewrite.at, text: `\n${hookImport}` });

  // The factory takes the place of the first sheet; the rest go away.
  const factory = [
    "const makeStyles = (colors: Palette) => ({",
    ...sheets.map((sheet) => {
      const body = sheet.init
        .getText(source)
        .split("\n")
        .map((line, index) => (index === 0 ? line : `  ${line}`))
        .join("\n");
      return `  ${sheet.name}: ${body},`;
    }),
    "});",
    "",
  ].join("\n");
  const [first, ...rest] = sheets;
  edits.push({
    start: first.statement.getStart(source),
    end: first.statement.getEnd(),
    text: factory.trimEnd(),
  });
  for (const sheet of rest) {
    const start = sheet.statement.getStart(source);
    const end = sheet.statement.getEnd();
    edits.push({ start, end: text.slice(end).match(/^\n/)?.[0] === "\n" ? end + 1 : end, text: "" });
  }

  for (const fn of targets) {
    const body = fn.body;
    if (body == null || !ts.isBlock(body) || body.statements.length === 0) {
      return "hand";
    }
    if (body.getText(source).includes("useThemedStyles(")) {
      continue;
    }
    const names = ownIdentifiers(fn, componentsInFile);
    const bound = [...sheetNames].filter((name) => names.has(name));
    if (names.has("colors")) {
      bound.push("colors");
    }
    const indent = indentOf(text, body.statements[0].getStart(source));
    edits.push({
      start: body.getStart(source) + 1,
      end: body.getStart(source) + 1,
      text: `\n${indent}const { ${bound.join(", ")} } = useThemedStyles(makeStyles);`,
    });
  }

  let next = text;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
  }
  fs.writeFileSync(file, next);
  return "converted";
}

const files = walk(src);
const counts = { converted: 0, skipped: 0, hand: 0 };
for (const file of files) {
  const result = convert(file);
  counts[result] += 1;
  if (result === "hand") {
    console.log(`hand: ${path.relative(root, file)}`);
  }
}
console.log(
  `converted ${counts.converted}, skipped ${counts.skipped}, hand ${counts.hand}`,
);
