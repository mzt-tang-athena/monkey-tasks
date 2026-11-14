import { describe, expect, it } from "vitest";
import {
  buildEntry,
  entrySegments,
  foodLabel,
  hasFoodTag,
  journalPage,
  parseDailyNote,
  planAppend,
  segmentsOf,
  timeLine,
} from "./format";

const live = [
  "---",
  "banner_image: Attachments/Banners/office.jpg",
  "banner_position: 20",
  "---",
  "",
  "**To-do**",
  "- [ ] Call the bank",
  "",
  "8:05",
  "- Woke up early",
  "",
  "12:40",
  "- Ate: [[oatmeal]] with milk #food",
  "- Ate: [[chinese-steamed-eggs]] #food #protein",
  "",
  "19:52",
  "- Went out for dessert with others",
  "- Fixing monkey-budget category and groups issues",
  "",
  "![[daily.base]]",
  "",
].join("\n");

const at = (hours: number, minutes: number) =>
  new Date(2026, 9, 26, hours, minutes);

describe("parseDailyNote", () => {
  it("reads the time blocks of a live note and skips everything else", () => {
    const blocks = parseDailyNote(live);
    expect(blocks.map((block) => block.time)).toEqual(["8:05", "12:40", "19:52"]);
    expect(blocks.map((block) => block.entries.map((entry) => entry.text))).toEqual([
      ["Woke up early"],
      [
        "Ate: [[oatmeal]] with milk #food",
        "Ate: [[chinese-steamed-eggs]] #food #protein",
      ],
      [
        "Went out for dessert with others",
        "Fixing monkey-budget category and groups issues",
      ],
    ]);
  });

  it("never starts a block inside the frontmatter", () => {
    const blocks = parseDailyNote("---\n12:40\n---\n9:00\n- in the body\n");
    expect(blocks.map((block) => block.time)).toEqual(["9:00"]);
  });

  it("ends a block at a blank or unknown line", () => {
    const blocks = parseDailyNote("9:00\n- one\nloose text\n- orphan\n10:00\n\n- after a gap\n");
    expect(blocks.map((block) => block.entries.length)).toEqual([1, 0]);
  });

  it("reads a CRLF note", () => {
    const blocks = parseDailyNote("9:00\r\n- one\r\n- two\r\n");
    expect(blocks[0].entries.map((entry) => entry.text)).toEqual(["one", "two"]);
  });

  it("gives equal blocks distinct ids", () => {
    const blocks = parseDailyNote("9:00\n- same\n\n9:00\n- same\n");
    expect(blocks[0].id).not.toBe(blocks[1].id);
  });
});

describe("food", () => {
  it("finds the #food tag as a whole word only", () => {
    expect(hasFoodTag("Ate: toast #food")).toBe(true);
    expect(hasFoodTag("toast #food, then tea")).toBe(true);
    expect(hasFoodTag("toast #Food")).toBe(true);
    expect(hasFoodTag("toast #foodie")).toBe(false);
    expect(hasFoodTag("toast #food-based")).toBe(false);
    expect(hasFoodTag("toast food")).toBe(false);
  });

  it("finds food by the tag, not the prefix", () => {
    const page = journalPage("2026-10-26", "9:00\n- toast #food\n- Ate: nothing\n");
    expect(page.food.map((line) => line.label)).toEqual(["toast"]);
  });

  it("lists the food lines newest last with plain labels", () => {
    const page = journalPage("2026-10-26", live);
    expect(page.food.map(({ time, label }) => ({ time, label }))).toEqual([
      { time: "12:40", label: "oatmeal with milk" },
      { time: "12:40", label: "chinese-steamed-eggs #protein" },
    ]);
  });

  it("shows a link's alias when it has one", () => {
    expect(foodLabel("Ate: [[oatmeal|porridge]] #food")).toBe("porridge");
  });

  it("draws Ate as a label, hides #food and keeps other tags", () => {
    const [block] = parseDailyNote("9:00\n- Ate: [[oatmeal]] hot #food #protein\n");
    expect(entrySegments(block.entries[0])).toEqual([
      { kind: "ate", text: "Ate" },
      { kind: "text", text: " " },
      { kind: "link", text: "oatmeal", name: "oatmeal" },
      { kind: "text", text: " hot " },
      { kind: "tag", text: "#protein" },
    ]);
  });
});

describe("segmentsOf", () => {
  it("cuts links and tags out of plain text", () => {
    expect(segmentsOf("met [[Sam Lee#work|Sam]] about #budget")).toEqual([
      { kind: "text", text: "met " },
      { kind: "link", text: "Sam", name: "Sam Lee" },
      { kind: "text", text: " about " },
      { kind: "tag", text: "#budget" },
    ]);
  });

  it("leaves a hash inside a word alone", () => {
    expect(segmentsOf("issue a#1")).toEqual([{ kind: "text", text: "issue a#1" }]);
  });
});

describe("buildEntry", () => {
  it("writes one bullet per typed line at the local time", () => {
    expect(buildEntry({ text: "one\n\n  two  \n", food: false, at: at(9, 5) })).toEqual({
      time: "09:05",
      block: "09:05\n- one\n- two",
    });
  });

  it("drops a typed bullet so it does not double", () => {
    expect(buildEntry({ text: "- one", food: false, at: at(9, 5) })?.block).toBe(
      "09:05\n- one",
    );
  });

  it("marks every line as food with the chip on", () => {
    expect(buildEntry({ text: "toast\neggs #protein", food: true, at: at(12, 40) })?.block).toBe(
      "12:40\n- Ate: toast #food\n- Ate: eggs #protein #food",
    );
  });

  it("does not double a typed prefix or tag", () => {
    expect(buildEntry({ text: "ate: toast #food", food: true, at: at(12, 40) })?.block).toBe(
      "12:40\n- ate: toast #food",
    );
  });

  it("leaves a plain entry alone with the chip off", () => {
    expect(buildEntry({ text: "toast", food: false, at: at(12, 40) })?.block).toBe(
      "12:40\n- toast",
    );
  });

  it("builds nothing from blank text", () => {
    expect(buildEntry({ text: " \n\n", food: true, at: at(9, 0) })).toBeNull();
  });

  it("pads the time", () => {
    expect(timeLine(at(0, 7))).toBe("00:07");
  });
});

describe("planAppend", () => {
  const block = "20:15\n- new line";

  it("inserts before the embed and keeps every earlier byte", () => {
    const { text, appended } = planAppend(live, block);
    const prefix = live.slice(0, live.indexOf("\n![[daily.base]]"));
    expect(appended).toBe(true);
    expect(text.startsWith(prefix)).toBe(true);
    expect(text.slice(prefix.length)).toBe(
      "\n20:15\n- new line\n\n![[daily.base]]\n",
    );
  });

  it("writes a new note as the block alone", () => {
    expect(planAppend("", block).text).toBe("20:15\n- new line\n");
  });

  it("appends after a note with no trailing newline", () => {
    expect(planAppend("9:00\n- one", block).text).toBe(
      "9:00\n- one\n\n20:15\n- new line\n",
    );
  });

  it("keeps trailing blank lines after the new block", () => {
    expect(planAppend("9:00\n- one\n\n\n", block).text).toBe(
      "9:00\n- one\n\n20:15\n- new line\n\n\n",
    );
  });

  it("keeps the blank lines before the embed", () => {
    expect(planAppend("9:00\n- one\n\n\n![[daily.base]]", block).text).toBe(
      "9:00\n- one\n\n20:15\n- new line\n\n\n![[daily.base]]",
    );
  });

  it("puts a blank line between the block and an embed that had none", () => {
    expect(planAppend("9:00\n- one\n![[daily.base]]\n", block).text).toBe(
      "9:00\n- one\n\n20:15\n- new line\n\n![[daily.base]]\n",
    );
  });

  it("writes into a note that holds only the embed", () => {
    expect(planAppend("![[daily.base]]\n", block).text).toBe(
      "20:15\n- new line\n\n![[daily.base]]\n",
    );
  });

  it("keeps a CRLF note's line ending", () => {
    expect(planAppend("9:00\r\n- one\r\n\r\n![[daily.base]]\r\n", block).text).toBe(
      "9:00\r\n- one\r\n\r\n20:15\r\n- new line\r\n\r\n![[daily.base]]\r\n",
    );
  });

  it("appends after a note with only frontmatter", () => {
    expect(planAppend("---\nbanner: x\n---\n", block).text).toBe(
      "---\nbanner: x\n---\n\n20:15\n- new line\n",
    );
  });

  it("appends the same block twice on two first sends", () => {
    const once = planAppend("", block).text;
    const twice = planAppend(once, block);
    expect(twice.appended).toBe(true);
    expect(parseDailyNote(twice.text)).toHaveLength(2);
  });

  it("does not write a retried block that already ends the note", () => {
    const once = planAppend(live, block).text;
    expect(planAppend(once, block, { retry: true })).toEqual({
      text: once,
      appended: false,
    });
  });

  it("writes a retried block that did not land", () => {
    expect(planAppend(live, block, { retry: true }).appended).toBe(true);
  });

  it("writes nothing for an empty block", () => {
    expect(planAppend(live, "  ")).toEqual({ text: live, appended: false });
  });
});
