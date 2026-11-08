import * as React from "react";
import { Platform, type ScrollViewProps, type View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useAnimatedRef } from "react-native-reanimated";
import { ClipContext, DraggingContext, SessionContext } from "./internal/contexts";
import { useRegistry } from "./internal/session";

function prevent(event: TouchEvent) {
  event.preventDefault();
}

/**
 * The app's scroller. Inside a drag surface it gives its viewport to
 * the zones inside it, which clip to it, and it holds still while a
 * drag is picked up, so the rects measured at pickup stay true. On the
 * web a `touchmove` listener holds it, because `overflow: hidden`
 * makes the browser cancel the drag (ADR 0046).
 */
export function MotionScrollView(props: ScrollViewProps) {
  const session = React.useContext(SessionContext);
  const dragging = React.useContext(DraggingContext);
  const [id] = React.useState(() => session?.nextId() ?? -1);
  const ref = useAnimatedRef<View>();
  useRegistry(session?.ui.clips, id, ref);

  React.useEffect(() => {
    if (!dragging || Platform.OS !== "web") {
      return;
    }
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => document.removeEventListener("touchmove", prevent);
  }, [dragging]);

  // A list clones its scroll component with a ref of its own. Both
  // refs get the node.
  const outer = (props as { ref?: React.Ref<unknown> }).ref;
  const both = React.useCallback(
    (node: unknown) => {
      (ref as unknown as (node: unknown) => void)(node);
      if (typeof outer === "function") {
        outer(node);
      } else if (outer != null) {
        (outer as React.RefObject<unknown>).current = node;
      }
    },
    [ref, outer],
  );

  return (
    <ClipContext.Provider value={id}>
      <ScrollView
        {...props}
        ref={both as never}
        scrollEnabled={dragging ? false : props.scrollEnabled}
      />
    </ClipContext.Provider>
  );
}

/** For a `SectionList` or `FlatList`: `renderScrollComponent={renderMotionScroll}`. */
export function renderMotionScroll(props: ScrollViewProps) {
  return <MotionScrollView {...props} />;
}
