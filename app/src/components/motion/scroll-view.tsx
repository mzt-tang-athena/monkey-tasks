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
import { useAnimatedRef, useSharedValue } from "react-native-reanimated";
import { motion } from "@/lib/motion/tokens";
import { PagePullSurface, usePagePull } from "./pull";
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

/**
 * The page's pull on the web, where the browser owns a vertical drag.
 * A non-passive `touchmove` that starts at the top takes the gesture
 * and keeps the page still, as `touch-action` alone cannot: the browser
 * would spend the drag scrolling and cancel it. Upward travel is left
 * to the browser, so the page still scrolls.
 *
 * A drag that starts away from the top never takes part, so it only
 * scrolls. That is the same rule the native pan applies.
 */
function listenForPagePull(
  node: HTMLElement,
  page: {
    /** The page's scroll sits at the top right now. */
    atTop: () => boolean;
    /** The pull took the gesture: stop the click it may leave. */
    onTake: () => void;
    onPull: () => void;
  },
): () => void {
  let armed = false;
  let pulling = false;
  let startY = 0;
  let lastY = 0;

  const start = (event: TouchEvent) => {
    armed = event.touches.length === 1 && page.atTop();
    pulling = false;
    const y = event.touches[0]?.clientY;
    startY = lastY = y ?? 0;
  };
  const move = (event: TouchEvent) => {
    if (!armed) {
      return;
    }
    if (!page.atTop()) {
      armed = false;
      return;
    }
    const y = event.touches[0]?.clientY;
    if (y == null) {
      return;
    }
    lastY = y;
    const travel = y - startY;
    if (travel < 0) {
      armed = false;
      return;
    }
    if (travel > motion.pull.activate) {
      if (!pulling) {
        pulling = true;
        page.onTake();
      }
      event.preventDefault();
    }
  };
  const end = () => {
    if (armed && pulling && lastY - startY >= motion.pull.commit) {
      page.onPull();
    }
    armed = false;
    pulling = false;
  };
  const cancel = () => {
    armed = false;
    pulling = false;
  };

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
  ...props
}: MotionScrollProps & { onPull: () => void }) {
  const [atTop, setAtTop] = React.useState(true);
  // A scroll fires many events a second. Only the crossing of the top
  // flips the gate, so the screen re-renders twice per gesture at most.
  const gate = React.useRef(true);
  // What the finger found when it went down. A drag that reaches the
  // top partway through reads this, not the page's later state.
  const startedAtTop = useSharedValue(true);
  const pressCancel = usePressCancel();
  const dragging = React.useContext(DraggingContext);
  const dragGate = React.useRef(dragging);
  React.useLayoutEffect(() => {
    dragGate.current = dragging;
  }, [dragging]);
  const node = React.useRef<HTMLElement | null>(null);
  const onNode = React.useCallback((next: HTMLElement | null) => {
    node.current = next;
  }, []);
  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = event.nativeEvent.contentOffset.y <= atTopSlop;
      if (next !== gate.current) {
        gate.current = next;
        setAtTop(next);
      }
      onScroll?.(event);
    },
    [onScroll],
  );
  const handleTouchStart = React.useCallback(
    (event: GestureResponderEvent) => {
      startedAtTop.set(gate.current);
      onTouchStart?.(event);
    },
    [onTouchStart, startedAtTop],
  );

  React.useEffect(() => {
    if (Platform.OS !== "web" || node.current == null) {
      return;
    }
    return listenForPagePull(node.current, {
      atTop: () => gate.current && !dragGate.current,
      onTake: pressCancel.arm,
      onPull,
    });
  }, [onPull, pressCancel]);

  if (Platform.OS === "web") {
    return (
      <BaseScrollView
        {...props}
        ref={outer}
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onNode={onNode}
      />
    );
  }

  return (
    <PagePullSurface
      enabled={atTop}
      startedAtTop={startedAtTop}
      onPull={onPull}
    >
      <BaseScrollView
        {...props}
        ref={outer}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
      />
    </PagePullSurface>
  );
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
