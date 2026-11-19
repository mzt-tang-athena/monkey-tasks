import * as React from "react";
import { Platform, type ScrollViewProps, type View } from "react-native";
import { RefreshControl, ScrollView } from "react-native-gesture-handler";
import { useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import { ClipContext, DraggingContext, SessionContext } from "./internal/contexts";
import { useRegistry } from "./internal/session";
import type { ScrollOffset } from "./scroll-edge";

/** What a caller needs from the scroller: the imperative scroll calls. */
export type MotionScrollRef = {
  scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void;
  /** Scroll to the end of the content, as a journal page sits. */
  scrollToEnd: (options?: { animated?: boolean }) => void;
};

type MotionScrollProps = Omit<ScrollViewProps, "ref"> & {
  ref?: React.Ref<MotionScrollRef>;
  /** The scroller writes its offset here, on the UI thread. */
  offset?: ScrollOffset;
};

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
export function MotionScrollView({ ref: outer, offset, ...props }: MotionScrollProps) {
  const session = React.useContext(SessionContext);
  const dragging = React.useContext(DraggingContext);
  const [id] = React.useState(() => session?.nextId() ?? -1);
  const ref = useAnimatedRef<View>();
  useRegistry(session?.ui.clips, id, ref);
  useScrollOffset(offset == null ? null : ref, offset);

  React.useEffect(() => {
    if (!dragging || Platform.OS !== "web") {
      return;
    }
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => document.removeEventListener("touchmove", prevent);
  }, [dragging]);

  // A list clones its scroll component with a ref of its own. Both
  // refs get the node.
  const both = React.useCallback(
    (node: unknown) => {
      (ref as unknown as (node: unknown) => void)(node);
      if (typeof outer === "function") {
        outer(node as MotionScrollRef);
      } else if (outer != null) {
        (outer as React.RefObject<MotionScrollRef | null>).current =
          node as MotionScrollRef;
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

type ListScrollProps = ScrollViewProps & {
  onRefresh?: () => void;
  refreshing?: boolean;
};

/**
 * For a `SectionList` or `FlatList`:
 * `renderScrollComponent={renderMotionScroll}`. A list that asks for a
 * refresh gets the control here: a custom scroll component replaces
 * the list's default one, which is what builds it. The browser draws no
 * pull, so the web keeps the bare scroller and its pager swipes.
 */
export function renderMotionScroll(props: ListScrollProps) {
  const { onRefresh, refreshing, ...rest } = props;
  if (onRefresh == null || Platform.OS === "web") {
    return <MotionScrollView {...rest} />;
  }
  return (
    <MotionScrollView
      {...rest}
      refreshControl={
        <RefreshControl refreshing={refreshing === true} onRefresh={onRefresh} />
      }
    />
  );
}
