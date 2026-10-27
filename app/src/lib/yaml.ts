/**
 * The one emitter for frontmatter values (ticket 0032). It lives in
 * `lib` because the vault writer, capture and the preview's sample
 * notes all lay values out, and `lib` never depends on a feature.
 */

/**
 * Characters YAML refuses to hold raw: the control characters other
 * than tab, delete, the C1 block, the line separators, the byte order
 * mark and the two non-characters. A lone surrogate counts too.
 */
const UNPRINTABLE =
  /[\0-\x08\x0a-\x1f\x7f-\x9f\u2028\u2029\ufeff\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?:^|[^\ud800-\udbff])[\udc00-\udfff]/;

/**
 * A value a YAML parser reads back as the same string. Free text can
 * carry a colon, a leading `#`, or read as a boolean or a number, and
 * an unquoted one would change meaning or break the note.
 */
function plainScalar(value: string): boolean {
  if (value === "" || value !== value.trim() || UNPRINTABLE.test(value)) {
    return false;
  }
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(value)) {
    return false;
  }
  if (/:\s|:$|\s#/.test(value)) {
    return false;
  }
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(value)) {
    return false;
  }
  return !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(value);
}

/**
 * A double-quoted YAML scalar. JSON's escapes are a subset of YAML's,
 * but JSON leaves delete, the C1 block and a few more characters raw,
 * and YAML refuses those, so they become `\u` escapes too.
 */
function quoted(value: string): string {
  return JSON.stringify(value).replace(
    /[\x7f-\x9f\u2028\u2029\ufeff\ufffe\uffff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

/**
 * The one place a frontmatter value is laid out. A list is a block
 * under its key, because YAML reads an inline list of one item as a
 * string. A value that YAML would read as something else is quoted: a
 * wikilink reads as a nested list, a name with a colon breaks the
 * line, and `true` or `123` reads as a boolean or a number.
 */
export function serializeValue(value: string | string[] | number): string {
  if (typeof value === "number") {
    // A number stays a number: `order` is the one value the vault
    // holds unquoted.
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => `  - ${plainScalar(item) ? item : quoted(item)}`)
      .join("\n");
  }
  return plainScalar(value) ? value : quoted(value);
}
