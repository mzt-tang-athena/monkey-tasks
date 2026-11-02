/* eslint-disable react-hooks/globals */
// The Probe pattern: the test reads the hook result through a module
// binding, which is the shape the rule forbids in app code.
import * as React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it } from "vitest";
import type { CaptureTarget, ParsedCapture } from "@/types/task";
import { useCaptureDraft, type CaptureDraft } from "./use-capture-draft";

// The hook's contract: the draft and its send lifecycle, with no
// view attached. A successful send clears the draft, a failed one
// keeps it and reports the message.

let latest: CaptureDraft | null = null;
let targets: CaptureTarget[] = [];
let defaultTargetIndex = 0;
let onSend: (
  parsed: ParsedCapture,
  target: CaptureTarget,
) => void | Promise<void> = () => undefined;

function Probe() {
  latest = useCaptureDraft({
    targets,
    defaultTargetIndex,
    onSend,
  });
  return null;
}

async function mount(): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(React.createElement(Probe));
  });
  return renderer as unknown as ReactTestRenderer;
}

beforeEach(() => {
  latest = null;
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
    await mount();

    await act(async () => {
      latest!.setText("Buy milk");
    });
    await act(async () => {
      latest!.send();
      await Promise.resolve();
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].parsed.name).toBe("Buy milk");
    expect(sent[0].target).toEqual({ kind: "main" });
    expect(latest!.text).toBe("");
    expect(latest!.error).toBeNull();
    expect(latest!.sending).toBe(false);
  });

  it("keeps the draft and reports the message after a rejected send", async () => {
    onSend = async () => {
      throw new Error("the vault is read only");
    };
    await mount();

    await act(async () => {
      latest!.setText("Buy milk");
    });
    await act(async () => {
      latest!.send();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest!.text).toBe("Buy milk");
    expect(latest!.error).toBe("the vault is read only");
    expect(latest!.sending).toBe(false);

    // Reset clears both the draft and the error.
    await act(async () => {
      latest!.reset();
    });
    expect(latest!.text).toBe("");
    expect(latest!.error).toBeNull();
  });

  it("wraps the target when cycling", async () => {
    await mount();
    expect(latest!.target).toEqual({ kind: "main" });

    await act(async () => {
      latest!.cycleTarget();
    });
    expect(latest!.target).toEqual({ kind: "list", name: "Work" });

    await act(async () => {
      latest!.cycleTarget();
    });
    expect(latest!.target).toEqual({ kind: "main" });
  });

  it("resets the target when the default index changes", async () => {
    targets = [
      { kind: "main" },
      { kind: "list", name: "Work" },
      { kind: "list", name: "Home" },
    ];
    const renderer = await mount();
    expect(latest!.target).toEqual({ kind: "main" });

    // Cycle away from the default: Home, two steps on.
    await act(async () => {
      latest!.cycleTarget();
    });
    await act(async () => {
      latest!.cycleTarget();
    });
    expect(latest!.target).toEqual({ kind: "list", name: "Home" });

    // A new screen default lands in the render, not an effect.
    defaultTargetIndex = 1;
    await act(async () => {
      renderer.update(React.createElement(Probe));
    });
    expect(latest!.target).toEqual({ kind: "list", name: "Work" });
  });

  it("does not allow a send while blank or already sending", async () => {
    const gate = Promise.withResolvers<void>();
    onSend = () => gate.promise;
    await mount();

    expect(latest!.canSend).toBe(false);

    await act(async () => {
      latest!.setText("Buy milk");
    });
    expect(latest!.canSend).toBe(true);

    await act(async () => {
      latest!.send();
    });
    expect(latest!.sending).toBe(true);
    expect(latest!.canSend).toBe(false);

    await act(async () => {
      gate.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest!.sending).toBe(false);
  });
});
