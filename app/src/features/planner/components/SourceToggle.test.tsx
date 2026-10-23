import * as React from "react";
import { act, create } from "react-test-renderer";
import type {
  ReactTestInstance,
  ReactTestRenderer,
  ReactTestRendererNode,
} from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

// The chip renders React Native views, and this suite runs on node
// without the native runtime, so the host components are stand-ins
// that keep their props: a tap is the Pressable's onPress, exactly as
// the app wires it. The harness owns the source state and cycles it
// through the same model helper the screen uses.

vi.mock("react-native", async () => {
  // vi.mock factories are hoisted above this module's static imports,
  // so React cannot be a top-level binding here. A static import
  // cannot work inside a hoisted factory; the module specifier is a
  // literal only because the factory must return the mock now.
  const { createElement } = await import("react");

  type HostProps = { children?: React.ReactNode } & Record<string, unknown>;

  function host(name: string) {
    return function Host({ children, ...props }: HostProps) {
      return createElement(
        name,
        props as unknown as React.Attributes,
        children,
      );
    };
  }

  const OS = "android";
  const Platform = {
    OS,
    select: (spec: Record<string, unknown>) => spec[OS],
  };

  return {
    Platform,
    Pressable: host("Pressable"),
    StyleSheet: {
      create: <T,>(sheet: T) => sheet,
      hairlineWidth: 1,
    },
    Text: host("Text"),
    View: host("View"),
  };
});

import { cycleSource, type Source } from "../model";
import { SourceToggle } from "./SourceToggle";

/** The screen's wiring: one source state, cycled by the model rule. */
function Harness() {
  const [source, setSource] = React.useState<Source>("due-period");
  return (
    <SourceToggle
      source={source}
      mode="day"
      menuOpen={false}
      onCycle={cycleSource(source, setSource)}
      onOpenMenu={() => undefined}
    />
  );
}

async function mount(): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(<Harness />);
  });
  return renderer as unknown as ReactTestRenderer;
}

function chip(renderer: ReactTestRenderer): ReactTestInstance {
  const found = renderer.root.findAll(
    (node) => (node.type as unknown) === "Pressable",
  );
  expect(found).toHaveLength(1);
  return found[0];
}

/** The text a consumer reads, in tree order. */
function textOf(
  node: ReactTestRendererNode | ReactTestRendererNode[] | null,
): string {
  if (node == null) {
    return "";
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }
  if (typeof node === "string") {
    return node;
  }
  return textOf(node.children);
}

describe("SourceToggle", () => {
  it("cycles one source per tap", async () => {
    const renderer = await mount();

    act(() => {
      chip(renderer).props.onPressIn();
    });
    act(() => {
      chip(renderer).props.onPressOut();
    });
    act(() => {
      chip(renderer).props.onPress();
    });

    expect(textOf(renderer.toJSON())).toContain("Focus");
    expect(textOf(renderer.toJSON())).not.toContain("Main");
  });

  // Android's Pressability calls onPress on release and delays
  // onPressOut to its 130 ms minimum press duration, so a short tap
  // delivers the action while the chip still says it is pressed. The
  // chip must read the source it chose, not the preview of the one
  // after it: Due today would settle on Focus but flash Main.
  it("reads the chosen source when the action lands before the press-out", async () => {
    const renderer = await mount();

    act(() => {
      chip(renderer).props.onPressIn();
    });
    // While held, the chip previews the source the tap will pick.
    expect(textOf(renderer.toJSON())).toContain("Focus");

    act(() => {
      chip(renderer).props.onPress();
    });
    expect(textOf(renderer.toJSON())).toContain("Focus");
    expect(textOf(renderer.toJSON())).not.toContain("Main");

    act(() => {
      chip(renderer).props.onPressOut();
    });
    expect(textOf(renderer.toJSON())).toContain("Focus");
    expect(textOf(renderer.toJSON())).not.toContain("Main");
  });
});
