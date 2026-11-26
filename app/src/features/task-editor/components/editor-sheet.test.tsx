import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverlayHost } from "@/components/ui/overlay-host";
import { CelebrationProvider } from "@/components/motion/celebration";
import { useProgress } from "@/lib/motion/progress";
import type { TaskEdit } from "@/types/task";
import { EditorSheet } from "./editor-sheet";

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("@/stores/references/use-references", () => ({
  useReferenceNotes: () => ({ notes: [], error: null }),
}));

vi.mock("react-native-keyboard-controller", async () => {
  const { useSharedValue } = await import("react-native-reanimated");
  return {
    useReanimatedKeyboardAnimation: () => ({
      height: useSharedValue(0),
      progress: useSharedValue(0),
    }),
    useKeyboardState: () => 0,
  };
});

const draft: TaskEdit = {
  name: "Call Mum",
  due: null,
  recurrence: null,
  list: null,
  reminders: [],
  alertWeight: "harsh",
  body: "",
};

/** The sheet under the same providers as the app. */
function Sheet({
  done,
  onToggle,
  initialPicker,
}: {
  done: boolean;
  onToggle: () => void;
  initialPicker?: "due";
}) {
  const progress = useProgress(true, { ms: 220 });
  const nothing = () => {};
  return (
    <OverlayHost>
      <CelebrationProvider>
        <EditorSheet
          open
          progress={progress}
          initialPicker={initialPicker}
          draft={draft}
          done={done}
          today={new Date(2026, 9, 26)}
          lists={["Main"]}
          write={{ kind: "idle" }}
          onChange={nothing}
          onRetry={nothing}
          onClose={nothing}
          onDelete={nothing}
          onToggle={onToggle}
        />
      </CelebrationProvider>
    </OverlayHost>
  );
}

/** The z index of the nearest layer that sets one. */
function layerOf(element: HTMLElement): number {
  for (let at = element.parentElement; at != null; at = at.parentElement) {
    const z = window.getComputedStyle(at).zIndex;
    if (z !== "" && z !== "auto") {
      return Number(z);
    }
  }
  return 0;
}

/** Lets the burst's measure call and any state update land. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });

describe("the editor sheet's tick", () => {
  it("plays one burst from its mark done", async () => {
    const onToggle = vi.fn();
    render(<Sheet done={false} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: "mark done" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId("tick-burst")).toBeTruthy();
  });

  it("draws the burst over the sheet it came from", async () => {
    render(<Sheet done={false} onToggle={vi.fn()} />);
    const sheet = screen.getByRole("dialog", { name: "Task" });

    fireEvent.click(screen.getByRole("button", { name: "mark done" }));
    const burst = await screen.findByTestId("tick-burst");

    expect(layerOf(burst)).toBeGreaterThan(layerOf(sheet));
  });

  it("plays nothing when it reopens a done task", async () => {
    const onToggle = vi.fn();
    render(<Sheet done onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: "mark not done" }));
    await settle();

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("tick-burst")).toBeNull();
  });
});

describe("the editor sheet's first picker", () => {
  it("opens on the Due picker when the caller asks, as Pick a day does", async () => {
    render(<Sheet done={false} onToggle={vi.fn()} initialPicker="due" />);

    expect(await screen.findByRole("dialog", { name: "Due" })).toBeTruthy();
  });

  it("opens on the task alone otherwise", () => {
    render(<Sheet done={false} onToggle={vi.fn()} />);

    expect(screen.queryByRole("dialog", { name: "Due" })).toBeNull();
  });
});
