import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePressCancel } from "./press-cancel";

/** A document click that reports whether it survived the guard. */
function watch() {
  const seen: string[] = [];
  const listener = () => seen.push("press");
  document.addEventListener("click", listener);
  return {
    seen,
    stop: () => document.removeEventListener("click", listener),
  };
}

describe("usePressCancel", () => {
  it("stops the drag's click, however late it arrives", async () => {
    const { result } = renderHook(() => usePressCancel());
    const click = watch();
    act(() => result.current.arm());

    document.body.click();
    expect(click.seen, "the drag's click is dropped").toEqual([]);

    await new Promise((done) => setTimeout(done, 10));
    document.body.click();
    expect(click.seen, "a later click is not swallowed").toEqual(["press"]);

    act(() => result.current.dispose());
    click.stop();
  });

  it("lets a pointer down or a key down clear the guard", () => {
    const { result } = renderHook(() => usePressCancel());
    const click = watch();

    act(() => result.current.arm());
    window.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    document.body.click();
    expect(click.seen, "a pointer press clears the guard").toEqual(["press"]);

    act(() => result.current.arm());
    window.dispatchEvent(new Event("keydown", { bubbles: true }));
    document.body.click();
    expect(click.seen, "a key press clears the guard").toEqual(["press", "press"]);

    act(() => result.current.dispose());
    click.stop();
  });
});
