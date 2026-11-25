import { describe, expect, it } from "vitest";
import { BOARD_LIST, listTabs, MAIN_LIST, TODAY_LIST } from "./list-tabs";

describe("listTabs", () => {
  it("leads with Today, then Main, then the list notes", () => {
    expect(
      listTabs(["Errands", "Focus"], { todayList: "on", boardList: "off" }),
    ).toEqual([TODAY_LIST, MAIN_LIST, "Errands", "Focus"]);
  });

  it("leads with Main when Today is off", () => {
    expect(
      listTabs(["Errands"], { todayList: "off", boardList: "off" }),
    ).toEqual([MAIN_LIST, "Errands"]);
  });

  it("puts Board after Main and before the list notes", () => {
    expect(
      listTabs(["Errands", "Focus"], { todayList: "on", boardList: "on" }),
    ).toEqual([TODAY_LIST, MAIN_LIST, BOARD_LIST, "Errands", "Focus"]);
  });

  it("puts Board right after Main when Today is off", () => {
    expect(
      listTabs(["Errands"], { todayList: "off", boardList: "on" }),
    ).toEqual([MAIN_LIST, BOARD_LIST, "Errands"]);
  });

  it("makes one tab for a list note named Today or Main", () => {
    expect(
      listTabs(["Today", "Main", "Focus"], { todayList: "on", boardList: "off" }),
    ).toEqual([TODAY_LIST, MAIN_LIST, "Focus"]);
  });
});
