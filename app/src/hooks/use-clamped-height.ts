import * as React from "react";
import type { LayoutChangeEvent } from "react-native";

/**
 * A scroll body's height: as tall as its content, and never taller than
 * the cap. A sheet sits at the bottom edge, so an uncapped body grows
 * past the window and its last control cannot be reached. The content
 * reports its own height, because a scroll view reports its viewport.
 */
export function useClampedHeight(cap: number): {
  height: number | undefined;
  onLayout: (event: LayoutChangeEvent) => void;
} {
  const [content, setContent] = React.useState(0);
  return {
    height: content === 0 ? undefined : Math.min(content, cap),
    onLayout: (event) => setContent(event.nativeEvent.layout.height),
  };
}
