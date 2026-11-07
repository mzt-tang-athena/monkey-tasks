// Finds a node in a `uiautomator dump` file and prints its bounds.
//
//   node android-ui.mjs <dump.xml> find <handle>   -> "x y left top right bottom"
//   node android-ui.mjs <dump.xml> text <handle>   -> the node's text, or its label
//   node android-ui.mjs <dump.xml> list            -> one line per labelled node
//
// A handle matches a node's content-desc (React Native's
// accessibilityLabel), its resource-id (a testID, when the app sets
// testID as the resource id), or its text, in that order. Each is an
// exact match. A handle that starts with `~` matches as a substring.
// With several matches, `find` takes the first one on screen in
// document order. Exit code 1 means no match.
import { readFileSync } from "node:fs";

const [file, command, handle] = process.argv.slice(2);
const xml = readFileSync(file, "utf8");

const decode = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#10;/g, "\n")
    .replace(/&amp;/g, "&");

const nodes = [];
for (const match of xml.matchAll(/<node\b([^>]*?)\/?>/g)) {
  const attrs = {};
  for (const [, key, value] of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) {
    attrs[key] = decode(value);
  }
  const box = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(attrs.bounds ?? "");
  if (box == null) continue;
  const [left, top, right, bottom] = box.slice(1).map(Number);
  nodes.push({
    desc: attrs["content-desc"] ?? "",
    id: (attrs["resource-id"] ?? "").replace(/^.*:id\//, ""),
    text: attrs.text ?? "",
    left,
    top,
    right,
    bottom,
  });
}

const visible = (node) => node.right > node.left && node.bottom > node.top;

if (command === "list") {
  for (const node of nodes.filter(visible)) {
    if (!node.desc && !node.id && !node.text) continue;
    const parts = [];
    if (node.desc) parts.push(`desc=${JSON.stringify(node.desc)}`);
    if (node.id) parts.push(`id=${JSON.stringify(node.id)}`);
    if (node.text) parts.push(`text=${JSON.stringify(node.text)}`);
    console.log(
      `${parts.join(" ")} [${node.left},${node.top}][${node.right},${node.bottom}]`,
    );
  }
  process.exit(0);
}

if (!["find", "text"].includes(command) || handle == null) {
  console.error("usage: android-ui.mjs <dump.xml> find|text <handle> | list");
  process.exit(2);
}

const partial = handle.startsWith("~");
const wanted = partial ? handle.slice(1) : handle;
const matches = (value) =>
  value !== "" && (partial ? value.includes(wanted) : value === wanted);

for (const field of ["desc", "id", "text"]) {
  const node = nodes.find((n) => visible(n) && matches(n[field]));
  if (node && command === "text") {
    console.log(node.text || node.desc);
    process.exit(0);
  }
  if (node) {
    const x = Math.round((node.left + node.right) / 2);
    const y = Math.round((node.top + node.bottom) / 2);
    console.log(`${x} ${y} ${node.left} ${node.top} ${node.right} ${node.bottom}`);
    process.exit(0);
  }
}
process.exit(1);
