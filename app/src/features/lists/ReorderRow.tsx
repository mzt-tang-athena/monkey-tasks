/* eslint-disable react-hooks/refs */
import * as React from "react";
import {
  Platform,
  StyleSheet,
  View,
  type PointerEvent as RNPointerEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { colors, drag, touchTarget } from "../../theme/tokens";

/**
 * A row that can be picked up for a manual reorder: a long press on
 * the phone, the same hold on the web. The screen owns the clock and
 * the drop; this only reports where the pointer is.
 */
export function ReorderRow({
  enabled,
  onHold,
  onPickup,
  onMove,
  onEnd,
  children,
}: {
  enabled: boolean;
  /** The finger landed: the screen starts the hold clock. */
  onHold?: (e: RNPointerEvent) => void;
  /** The hold elapsed on the phone, so the drag is armed. */
  onPickup?: (x: number, y: number) => void;
  onMove?: (x: number, y: number) => void;
  onEnd?: () => void;
  children: React.ReactNode;
}) {
  if (!enabled) {
    return <>{children}</>;
  }
  if (Platform.OS === "web") {
    return (
      <View style={styles.fill} onPointerDown={onHold}>
        {children}
      </View>
    );
  }
  return (
    <NativeReorder onPickup={onPickup} onMove={onMove} onEnd={onEnd}>
      {children}
    </NativeReorder>
  );
}

/**
 * The visible drag handle: six dots, two columns by three. A press on
 * it picks the row up at once, so reordering does not need a hold or
 * a guess. Only My order shows it.
 */
export function ReorderGrip({
  onPickup,
  onMove,
  onEnd,
}: {
  onPickup: (x: number, y: number) => void;
  onMove?: (x: number, y: number) => void;
  onEnd?: () => void;
}) {
  const content = (
    <View style={styles.grip}>
      <View style={styles.gripDots}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.gripRow}>
            <View style={styles.gripDot} />
            <View style={styles.gripDot} />
          </View>
        ))}
      </View>
    </View>
  );
  if (Platform.OS === "web") {
    return (
      <View
        onPointerDown={(e) =>
          onPickup(e.nativeEvent.pageX, e.nativeEvent.pageY)
        }
      >
        {content}
      </View>
    );
  }
  return (
    <NativeGrip onPickup={onPickup} onMove={onMove} onEnd={onEnd}>
      {content}
    </NativeGrip>
  );
}

function NativeGrip({
  onPickup,
  onMove,
  onEnd,
  children,
}: {
  onPickup: (x: number, y: number) => void;
  onMove?: (x: number, y: number) => void;
  onEnd?: () => void;
  children: React.ReactNode;
}) {
  const active = React.useRef(false);
  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onStart((e) => {
          active.current = true;
          onPickup(e.absoluteX, e.absoluteY);
        })
        .onUpdate((e) => onMove?.(e.absoluteX, e.absoluteY))
        .onEnd(() => {
          active.current = false;
          onEnd?.();
        })
        .onFinalize(() => {
          if (active.current) {
            active.current = false;
            onEnd?.();
          }
        }),
    [onPickup, onMove, onEnd],
  );
  // The wrapper keeps the row's own ref off the element the gesture
  // clones: GestureDetector replaces its child's ref, so a ref on the
  // child itself never fires.
  return (
    <GestureDetector gesture={pan}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

function NativeReorder({
  onPickup,
  onMove,
  onEnd,
  children,
}: {
  onPickup?: (x: number, y: number) => void;
  onMove?: (x: number, y: number) => void;
  onEnd?: () => void;
  children: React.ReactNode;
}) {
  const active = React.useRef(false);
  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activateAfterLongPress(drag.pickMs)
        .onStart((e) => {
          active.current = true;
          onPickup?.(e.absoluteX, e.absoluteY);
        })
        .onUpdate((e) => onMove?.(e.absoluteX, e.absoluteY))
        .onEnd(() => {
          active.current = false;
          onEnd?.();
        })
        .onFinalize(() => {
          if (active.current) {
            active.current = false;
            onEnd?.();
          }
        }),
    [onPickup, onMove, onEnd],
  );
  // The wrapper keeps the row's own ref off the element the gesture
  // clones: GestureDetector replaces its child's ref, so a ref on the
  // child itself never fires.
  return (
    <GestureDetector gesture={pan}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  grip: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  gripDots: {
    gap: 3,
  },
  gripRow: {
    flexDirection: "row",
    gap: 4,
  },
  gripDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.inkFaint,
  },
});
