// Reads a `uiautomator dump` of the notification shade and says what to
// tap next to press a button on one notification.
//
//   node android-shade.mjs <dump.xml> <title> <button>
//
// It prints one line: "press X Y" when the button shows, "expand X Y"
// for the group or notification to open first, or "none" when the
// title is not in the shade. Android groups the app's notifications and
// folds each one, so a press takes a few taps.
import { readFileSync } from "node:fs";

const [file, title, button] = process.argv.slice(2);
if (file == null || title == null || button == null) {
  console.error("usage: android-shade.mjs <dump.xml> <title> <button>");
  process.exit(2);
}

const nodes = [];
for (const match of readFileSync(file, "utf8").matchAll(/<node\b([^>]*?)\/?>/g)) {
  const attrs = {};
  for (const [, key, value] of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) {
    attrs[key] = value;
  }
  const box = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(attrs.bounds ?? "");
  if (box == null) continue;
  const [left, top, right, bottom] = box.slice(1).map(Number);
  nodes.push({
    id: (attrs["resource-id"] ?? "").replace(/^.*:id\//, ""),
    text: attrs.text ?? "",
    desc: attrs["content-desc"] ?? "",
    left,
    top,
    right,
    bottom,
  });
}

const area = (n) => (n.right - n.left) * (n.bottom - n.top);
const within = (outer) => (n) =>
  n.left >= outer.left &&
  n.right <= outer.right &&
  n.top >= outer.top &&
  n.bottom <= outer.bottom;
const centre = (n) =>
  `${Math.round((n.left + n.right) / 2)} ${Math.round((n.top + n.bottom) / 2)}`;

const rows = nodes.filter((n) => n.id === "expandableNotificationRow");
const titles = nodes.filter((n) => n.id === "title" && n.text === title);

if (titles.length > 0) {
  const target = titles[0];
  const row = rows
    .filter((r) => r.top <= target.top && r.bottom >= target.bottom)
    .sort((a, b) => area(a) - area(b))[0];
  if (row != null) {
    const inRow = nodes.filter(within(row));
    const action = nodes.find(
      (n) => n.text === button && n.top >= row.top && n.top <= row.bottom + 400 && n.left >= row.left && n.right <= row.right,
    );
    if (action != null) {
      console.log(`press ${centre(action)}`);
      process.exit(0);
    }
    const expand = inRow.find((n) => n.id === "expand_button" && n.desc === "Expand");
    if (expand != null) {
      console.log(`expand ${centre(expand)}`);
      process.exit(0);
    }
  }
}

const group = rows.sort((a, b) => area(b) - area(a))[0];
const open = group == null ? null : nodes.filter(within(group)).find((n) => n.id === "expand_button" && n.desc === "Expand");
if (open != null) {
  console.log(`expand ${centre(open)}`);
  process.exit(0);
}
console.log("none");
