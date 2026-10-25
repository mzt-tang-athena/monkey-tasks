/* eslint-disable react-hooks/refs */
import * as React from "react";
import {
  Platform,
  View,
  type PointerEvent as RNPointerEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { drag } from "../../theme/tokens";

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
    return <View onPointerDown={onHold}>{children}</View>;
  }
  return (
    <NativeReorder onPickup={onPickup} onMove={onMove} onEnd={onEnd}>
      {children}
    </NativeReorder>
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
  return <GestureDetector gesture={pan}>{children}</GestureDetector>;
}
