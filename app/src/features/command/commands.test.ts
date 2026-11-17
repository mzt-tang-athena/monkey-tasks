import { describe, expect, it, vi } from "vitest";
import { buildCommands, type CommandSources } from "./commands";

function sources(overrides: Partial<CommandSources> = {}): CommandSources {
  return {
    sortLabel: "Due date",
    themeLabel: "Budget",
    nextList: "Errands",
    addTask: vi.fn(),
    goLists: vi.fn(),
    goPlanner: vi.fn(),
    switchList: vi.fn(),
    openSettings: vi.fn(),
    openDiagnostics: vi.fn(),
    ...overrides,
  };
}

function byId(id: string, context = sources()) {
  const command = buildCommands(context).find((item) => item.id === id);
  if (command == null) {
    throw new Error(`no command ${id}`);
  }
  return command;
}

describe("buildCommands", () => {
  it("offers one switch that names the next list", () => {
    const command = byId("switch");
    expect(command.label).toBe("Switch list");
    expect(command.hint).toBe("To Errands");
  });

  it("drops the switch when Main is the only tab", () => {
    const ids = buildCommands(sources({ nextList: null })).map((item) => item.id);
    expect(ids).not.toContain("switch");
  });

  it("runs the switch", () => {
    const switchList = vi.fn();
    byId("switch", sources({ switchList })).run();
    expect(switchList).toHaveBeenCalledTimes(1);
  });

  it("shows the current sort order and theme, and opens Settings", () => {
    const openSettings = vi.fn();
    const context = sources({ sortLabel: "My order", themeLabel: "Midnight", openSettings });
    expect(byId("sort", context).hint).toBe("My order");
    expect(byId("theme", context).hint).toBe("Midnight");
    byId("sort", context).run();
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it("wires the navigation and diagnostic actions", () => {
    const context = sources();
    byId("lists", context).run();
    byId("planner", context).run();
    byId("diagnostics", context).run();
    byId("capture", context).run();
    expect(context.goLists).toHaveBeenCalledTimes(1);
    expect(context.goPlanner).toHaveBeenCalledTimes(1);
    expect(context.openDiagnostics).toHaveBeenCalledTimes(1);
    expect(context.addTask).toHaveBeenCalledTimes(1);
  });
});
