import { createElement } from "react";

/**
 * Stand-ins for the React Native modules the components import. The
 * suites run on node without the native runtime, so these keep the
 * props and nothing else: a tap is the Pressable's onPress, exactly
 * as the app wires it.
 */

export type HostProps = { children?: React.ReactNode } & Record<string, unknown>;

export function host(name: string) {
  return function Host({ children, ...props }: HostProps) {
    return createElement(name, props as unknown as React.Attributes, children);
  };
}

/** A value the stand-ins can set and read. No frames run in node. */
export class StandinValue {
  constructor(public current: number) {}

  setValue(next: number) {
    this.current = next;
  }

  interpolate() {
    return this;
  }

  stopAnimation() {}
}

type End = (result: { finished: boolean }) => void;

/** An animation that ends at once, with or without a callback. */
const finish = (callback?: End) => callback?.({ finished: true });

export const AnimatedStandin = {
  Value: StandinValue,
  View: host("AnimatedView"),
  timing: () => ({ start: finish }),
  spring: () => ({ start: finish }),
  sequence: () => ({ start: () => {} }),
};

export const AccessibilityInfoStandin = {
  isReduceMotionEnabled: async () => false,
  addEventListener: () => ({ remove() {} }),
};

export const StyleSheetStandin = {
  create: <T,>(sheet: T) => sheet,
  hairlineWidth: 1,
};

export function PlatformStandin(os: "android" | "ios" | "web" = "android") {
  return {
    OS: os,
    select: (spec: Record<string, unknown>) => spec[os],
  };
}
