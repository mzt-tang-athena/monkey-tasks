import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { CaptureTarget, ParsedCapture } from "@/types/task";
import { useCaptureDraft } from "./use-capture-draft";

// The hook's contract: the draft and its send lifecycle, with no
// view attached. A successful send clears the draft, a failed one
// keeps it and reports the message.

let targets: CaptureTarget[] = [];
let defaultTargetIndex = 0;
let onSend: (
  parsed: ParsedCapture,
  target: CaptureTarget,
) => void | Promise<void> = () => undefined;

function mount() {
  return renderHook(() =>
    useCaptureDraft({ targets, defaultTargetIndex, onSend }),
  );
}

beforeEach(() => {
  defaultTargetIndex = 0;
  targets = [{ kind: "main" }, { kind: "list", name: "Work" }];
  onSend = () => undefined;
});

describe("useCaptureDraft", () => {
  it("clears the draft after a successful send", async () => {
    const sent: { parsed: ParsedCapture; target: CaptureTarget }[] = [];
    onSend = (parsed, target) => {
      sent.push({ parsed, target });
    };
    const { result } = mount();

    await act(async () => {
      result.current.setText("Buy milk");
    });
    await act(async () => {
      result.current.send();
      await Promise.resolve();
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].parsed.name).toBe("Buy milk");
    expect(sent[0].target).toEqual({ kind: "main" });
    expect(result.current.text).toBe("");
    expect(result.current.error).toBeNull();
    expect(result.current.sending).toBe(false);
  });

  it("keeps the draft and reports the message after a rejected send", async () => {
    onSend = async () => {
      throw new Error("the vault is read only");
    };
    const { result } = mount();

    await act(async () => {
      result.current.setText("Buy milk");
    });
    await act(async () => {
      result.current.send();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.text).toBe("Buy milk");
    expect(result.current.error).toBe("the vault is read only");
    expect(result.current.sending).toBe(false);

    // Reset clears both the draft and the error.
    await act(async () => {
      result.current.reset();
    });
    expect(result.current.text).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("wraps the target when cycling", async () => {
    const { result } = mount();
    expect(result.current.target).toEqual({ kind: "main" });

    await act(async () => {
      result.current.cycleTarget();
    });
    expect(result.current.target).toEqual({ kind: "list", name: "Work" });

    await act(async () => {
      result.current.cycleTarget();
    });
    expect(result.current.target).toEqual({ kind: "main" });
  });

  it("resets the target when the default index changes", async () => {
    targets = [
      { kind: "main" },
      { kind: "list", name: "Work" },
      { kind: "list", name: "Home" },
    ];
    const { result, rerender } = mount();
    expect(result.current.target).toEqual({ kind: "main" });

    // Cycle away from the default: Home, two steps on.
    await act(async () => {
      result.current.cycleTarget();
    });
    await act(async () => {
      result.current.cycleTarget();
    });
    expect(result.current.target).toEqual({ kind: "list", name: "Home" });

    // A new screen default lands in the render, not an effect.
    defaultTargetIndex = 1;
    rerender();
    expect(result.current.target).toEqual({ kind: "list", name: "Work" });
  });

  it("does not allow a send while blank or already sending", async () => {
    const gate = Promise.withResolvers<void>();
    onSend = () => gate.promise;
    const { result } = mount();

    expect(result.current.canSend).toBe(false);

    await act(async () => {
      result.current.setText("Buy milk");
    });
    expect(result.current.canSend).toBe(true);

    await act(async () => {
      result.current.send();
    });
    expect(result.current.sending).toBe(true);
    expect(result.current.canSend).toBe(false);

    await act(async () => {
      gate.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.sending).toBe(false);
  });
});
