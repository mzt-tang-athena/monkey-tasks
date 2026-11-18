import * as React from "react";
import {
  Platform,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useAnimatedRef } from "react-native-reanimated";
import { motion } from "@/lib/motion/tokens";
import { usePagePull } from "./pull";
import { ClipContext, DraggingContext, SessionContext } from "./internal/contexts";
import { usePressCancel } from "./internal/press-cancel";
import { useRegistry } from "./internal/session";

/** What a caller needs from the scroller: the imperative scroll calls. */
export type MotionScrollRef = {
  scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void;
  /** Scroll to the end of the content, as a journal page sits. */
  scrollToEnd: (options?: { animated?: boolean }) => void;
};

type MotionScrollProps = Omit<ScrollViewProps, "ref"> & {
  ref?: React.Ref<MotionScrollRef>;
  /** The host node, for the web's pull listeners. */
  onNode?: (node: HTMLElement | null) => void;
};

/** The offset that still reads as the page's top, in points. */
const atTopSlop = 0.5;

/** One page pull: start at the top, travel down, release past commit. */
type PullPage = {
  /** The page's scroll sits at the top right now. */
  atTop: () => boolean;
  /** The pull took the gesture: stop the click it may leave. */
  onTake: () => void;
  onPull: () => void;
};

function createPullGate(page: PullPage) {
  let armed = false;
  let pulling = false;
  let startY = 0;
  let lastY = 0;
  return {
    start(y: number, multiTouch: boolean) {
      armed = !multiTouch && page.atTop();
      pulling = false;
      startY = lastY = y;
    },
    /** True when the move belongs to the pull and holds the page still. */
    move(y: number): boolean {
      if (!armed) {
        return false;
      }
      if (!page.atTop()) {
        armed = false;
        return false;
      }
      lastY = y;
      const travel = y - startY;
      if (travel < 0) {
        armed = false;
        return false;
      }
      if (travel <= motion.pull.activate) {
        return false;
      }
      if (!pulling) {
        pulling = true;
        page.onTake();
      }
      return true;
    },
    end() {
      if (armed && pulling && lastY - startY >= motion.pull.commit) {
        page.onPull();
      }
      armed = false;
      pulling = false;
    },
    cancel() {
      armed = false;
      pulling = false;
    },
  };
}

/**
 * The page's pull on the web, where the browser owns a vertical drag. A
 * non-passive `touchmove` holds the page still while the pull runs, as
 * `touch-action` alone cannot: the browser would spend the drag
 * scrolling and cancel it. Upward travel stays with the browser.
 */
function listenForPagePull(
  node: HTMLElement,
  gate: ReturnType<typeof createPullGate>,
): () => void {
  const start = (event: TouchEvent) => {
    gate.start(event.touches[0]?.clientY ?? 0, event.touches.length !== 1);
  };
  const move = (event: TouchEvent) => {
    if (gate.move(event.touches[0]?.clientY ?? 0)) {
      event.preventDefault();
    }
  };
  const end = () => gate.end();
  const cancel = () => gate.cancel();

  node.addEventListener("touchstart", start, { passive: true });
  node.addEventListener("touchmove", move, { passive: false });
  node.addEventListener("touchend", end);
  node.addEventListener("touchcancel", cancel);
  return () => {
    node.removeEventListener("touchstart", start);
    node.removeEventListener("touchmove", move);
    node.removeEventListener("touchend", end);
    node.removeEventListener("touchcancel", cancel);
  };
}

function prevent(event: TouchEvent) {
  event.preventDefault();
}

/**
 * The app's scroller. Inside a drag surface it gives its viewport to
 * the zones inside it, which clip to it, and it holds still while a
 * drag is picked up, so the rects measured at pickup stay true. On the
 * web a `touchmove` listener holds it, because `overflow: hidden`
 * makes the browser cancel the drag (ADR 0046).
 *
 * Under a `PagePull` it also carries the page's pull. A downward pull
 * that starts while its own scroll sits at the top opens the command
 * pane. The offset is read here, so every page gets the same rule and
 * every scroller is gated on the scroll it actually shows.
 */
export function MotionScrollView({ ref: outer, ...props }: MotionScrollProps) {
  const onPull = usePagePull();
  if (onPull == null) {
    return <BaseScrollView {...props} ref={outer} />;
  }
  return <PulledScrollView {...props} ref={outer} onPull={onPull} />;
}

function PulledScrollView({
  ref: outer,
  onPull,
  onScroll,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  ...props
}: MotionScrollProps & { onPull: () => void }) {
  // The offset is a ref, so a scroll never re-renders the page.
  const top = React.useRef(true);
  const pressCancel = usePressCancel();
  const dragging = React.useContext(DraggingContext);
  const dragGate = React.useRef(dragging);
  React.useLayoutEffect(() => {
    dragGate.current = dragging;
  }, [dragging]);
  const pull = React.useRef(onPull);
  React.useLayoutEffect(() => {
    pull.current = onPull;
  }, [onPull]);
  const node = React.useRef<HTMLElement | null>(null);
  const onNode = React.useCallback((next: HTMLElement | null) => {
    node.current = next;
  }, []);

  // The gate reads the refs when a touch runs, never during render.
  const gateRef = React.useRef<ReturnType<typeof createPullGate> | null>(null);
  const gateOf = React.useCallback(() => {
    if (gateRef.current == null) {
      gateRef.current = createPullGate({
        atTop: () => top.current && !dragGate.current,
        onTake: pressCancel.arm,
        onPull: () => pull.current(),
      });
    }
    return gateRef.current;
  }, [pressCancel]);

  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = event.nativeEvent.contentOffset.y <= atTopSlop;
      top.current = next;
      onScroll?.(event);
    },
    [onScroll],
  );
  const handleTouchStart = React.useCallback(
    (event: GestureResponderEvent) => {
      const touches = event.nativeEvent.touches;
      gateOf().start(touches[0]?.pageY ?? 0, touches.length !== 1);
      onTouchStart?.(event);
    },
    [gateOf, onTouchStart],
  );
  const handleTouchMove = React.useCallback(
    (event: GestureResponderEvent) => {
      gateOf().move(event.nativeEvent.touches[0]?.pageY ?? 0);
      onTouchMove?.(event);
    },
    [gateOf, onTouchMove],
  );
  const handleTouchEnd = React.useCallback(
    (event: GestureResponderEvent) => {
      gateOf().end();
      onTouchEnd?.(event);
    },
    [gateOf, onTouchEnd],
  );
  const handleTouchCancel = React.useCallback(
    (event: GestureResponderEvent) => {
      gateOf().cancel();
      onTouchCancel?.(event);
    },
    [gateOf, onTouchCancel],
  );

  React.useEffect(() => {
    if (Platform.OS !== "web" || node.current == null) {
      return;
    }
    return listenForPagePull(node.current, gateOf());
  }, [gateOf]);

  const shared = {
    ...props,
    ref: outer,
    onScroll: handleScroll,
    onTouchStart: Platform.OS === "web" ? onTouchStart : handleTouchStart,
    onTouchMove: Platform.OS === "web" ? onTouchMove : handleTouchMove,
    onTouchEnd: Platform.OS === "web" ? onTouchEnd : handleTouchEnd,
    onTouchCancel: Platform.OS === "web" ? onTouchCancel : handleTouchCancel,
  };

  if (Platform.OS === "web") {
    return <BaseScrollView {...shared} onNode={onNode} />;
  }
  return <BaseScrollView {...shared} />;
}

function BaseScrollView({ ref: outer, onNode, ...props }: MotionScrollProps) {
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
  const both = React.useCallback(
    (node: unknown) => {
      (ref as unknown as (node: unknown) => void)(node);
      onNode?.(node as HTMLElement | null);
      if (typeof outer === "function") {
        outer(node as MotionScrollRef);
      } else if (outer != null) {
        (outer as React.RefObject<MotionScrollRef | null>).current =
          node as MotionScrollRef;
      }
    },
    [ref, outer, onNode],
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
