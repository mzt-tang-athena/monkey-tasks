import { describe, expect, it } from "vitest";
import { GALLERY_SECTIONS, GALLERY_STATE_IDS, stateTestId } from "./model";

/**
 * The matrix is the contract between the page, the spec and a review
 * screenshot. A duplicated id would make one cell unreachable, and a
 * state id outside its section would make a test id lie about where the
 * state lives.
 */
describe("gallery matrix", () => {
  it("gives every state one id", () => {
    expect(new Set(GALLERY_STATE_IDS).size).toBe(GALLERY_STATE_IDS.length);
  });

  it("starts every state id with its section id", () => {
    for (const section of GALLERY_SECTIONS) {
      for (const state of section.states) {
        expect(state.id.startsWith(`${section.id}:`), state.id).toBe(true);
      }
    }
  });

  it("labels every state, with no repeat inside a section", () => {
    for (const section of GALLERY_SECTIONS) {
      const labels = section.states.map((state) => state.label);
      expect(labels.length, section.id).toBeGreaterThan(0);
      expect(new Set(labels).size, section.id).toBe(labels.length);
    }
  });

  it("names a cell by its state id", () => {
    expect(stateTestId("button:primary")).toBe("gallery-state:button:primary");
  });
});
