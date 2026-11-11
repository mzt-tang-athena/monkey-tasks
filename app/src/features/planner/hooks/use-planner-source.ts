import * as React from "react";
import type { View } from "react-native";
import { nextSource, type Source } from "@/features/planner/model";

/** The view the chooser opens from. */
export type MenuAnchor = React.RefObject<React.ComponentRef<typeof View> | null>;

/**
 * The bottom list's source, shared by all three modes, and the state of
 * its chooser: the due period by default, or a named list. A press on
 * the toggle cycles the source. A hold opens the chooser, which stays
 * open until a choice or a dismissal. Every callback keeps its identity.
 */
export function usePlannerSource() {
  const [source, setSource] = React.useState<Source>("due-period");
  // The toggle that opened the chooser, or null while it is closed.
  const [anchor, setAnchor] = React.useState<MenuAnchor | null>(null);

  const cycle = React.useCallback(() => setSource(nextSource), []);
  const openMenu = React.useCallback((from: MenuAnchor) => setAnchor(from), []);
  const closeMenu = React.useCallback(() => setAnchor(null), []);
  const choose = React.useCallback((next: Source) => {
    setSource(next);
    setAnchor(null);
  }, []);

  return { source, cycle, choose, anchor, openMenu, closeMenu };
}
