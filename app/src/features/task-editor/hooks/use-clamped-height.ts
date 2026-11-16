import * as React from "react";

/**
 * A scroll body's height: as tall as its content, and never taller than
 * the cap. A sheet sits at the bottom edge, so an uncapped body grows
 * past the window and its last control cannot be reached.
 */
export function useClampedHeight(cap: number): {
  height: number | undefined;
  onContentSizeChange: (width: number, height: number) => void;
} {
  const [content, setContent] = React.useState(0);
  return {
    height: content === 0 ? undefined : Math.min(content, cap),
    onContentSizeChange: (_width, height) => setContent(height),
  };
}
