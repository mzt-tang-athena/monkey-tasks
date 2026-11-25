import { describe, expect, it } from "vitest";
import { listTabs, MAIN_LIST, TODAY_LIST } from "./list-tabs";

describe("listTabs", () => {
  it("leads with Today, then Main, then every list note", () => {
    expect(listTabs(["Errands", "Focus"], { todayList: "on" })).toEqual([
      TODAY_LIST,
      MAIN_LIST,
      "Errands",
      "Focus",
    ]);
  });

  it("leads with Main when Today is off", () => {
    expect(listTabs(["Errands"], { todayList: "off" })).toEqual([
      MAIN_LIST,
      "Errands",
    ]);
  });

  it("makes one tab for a list note named Today or Main", () => {
    expect(listTabs(["Today", "Main", "Focus"], { todayList: "on" })).toEqual([
      TODAY_LIST,
      MAIN_LIST,
      "Focus",
    ]);
  });
});
