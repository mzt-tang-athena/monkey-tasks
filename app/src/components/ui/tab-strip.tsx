import * as React from "react";
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import {
  MotionScrollView,
  type MotionScrollRef,
} from "@/components/motion/scroll-view";
import { NoPanPressable } from "./pressable";
import { colors, radius, spacing, touchTarget, type } from "@/theme/tokens";

/** The fade's steps, from clear to solid, toward the strip's edge. A
    stepped fade needs no gradient library and draws the same on every
    platform. */
const fadeSteps = [0.12, 0.3, 0.52, 0.74, 0.9, 1];
/** Each step's width. */
const fadeStepWidth = 5;
const fadeWidth = fadeSteps.length * fadeStepWidth;
/** The scroll distance, in px, that counts as past an edge. */
const fadeEdge = 2;

/** A fade over the strip's edge, where more tabs wait past it. */
function Fade({ side }: { side: "start" | "end" }) {
  const steps = side === "end" ? fadeSteps : [...fadeSteps].reverse();
  return (
    <View
      testID={`tab-fade-${side}`}
      pointerEvents="none"
      style={[styles.fade, side === "end" ? styles.fadeEnd : styles.fadeStart]}
    >
      {steps.map((opacity) => (
        <View key={opacity} style={[styles.fadeStep, { opacity }]} />
      ))}
    </View>
  );
}

/**
 * A row of tabs that scrolls sideways, with a rule under the selected
 * one. When the selection changes, the strip scrolls that tab into
 * view, so the name of the page on screen is never off the edge. The
 * user can still scroll it by hand. Each tab is at least 44 by 44.
 * Where more tabs wait past an edge, the edge fades, so a clipped
 * name reads as "more this way" and not as a bug. The fade paints the
 * surface color, so the strip belongs on a surface.
 */
export function TabStrip({
  tabs,
  selected,
  onSelect,
  label,
}: {
  tabs: string[];
  selected: string;
  onSelect: (tab: string) => void;
  /** Names the tab list for assistive tech. */
  label: string;
}) {
  const strip = React.useRef<MotionScrollRef | null>(null);
  // Reanimated reads the system switch once, at load.
  const reduced = useReducedMotion();
  // Where each tab starts, from its layout. A tab keeps its place for
  // the session, so one measure is enough.
  const offsets = React.useRef<Record<string, number>>({});
  const [frame, setFrame] = React.useState({ view: 0, content: 0, x: 0 });
  const fadeStart = frame.x > fadeEdge;
  const fadeEnd = frame.content - frame.view - frame.x > fadeEdge;

  React.useEffect(() => {
    const x = offsets.current[selected];
    if (x == null) {
      return;
    }
    // Past the start fade, so the fade never pales the selected name.
    strip.current?.scrollTo({
      x: Math.max(0, x - fadeWidth),
      animated: !reduced,
    });
  }, [selected, reduced]);

  return (
    <View style={styles.strip}>
      <MotionScrollView
        ref={strip}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        role="tablist"
        aria-label={label}
        scrollEventThrottle={16}
        onLayout={(event: LayoutChangeEvent) => {
          const view = event.nativeEvent.layout.width;
          setFrame((current) => ({ ...current, view }));
        }}
        onContentSizeChange={(content) =>
          setFrame((current) => ({ ...current, content }))
        }
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const x = event.nativeEvent.contentOffset.x;
          setFrame((current) => ({ ...current, x }));
        }}
      >
        {tabs.map((name) => {
          const active = name === selected;
          return (
            <NoPanPressable
              key={name}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              onPress={() => onSelect(name)}
              onLayout={(event) => {
                offsets.current[name] = event.nativeEvent.layout.x;
              }}
              role="tab"
              aria-selected={active}
            >
              <Text style={[styles.text, active && styles.textActive]}>{name}</Text>
              <View style={[styles.rule, active && styles.ruleActive]} />
            </NoPanPressable>
          );
        })}
      </MotionScrollView>
      {fadeStart ? <Fade side="start" /> : null}
      {fadeEnd ? <Fade side="end" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexShrink: 1,
  },
  fade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    flexDirection: "row",
  },
  fadeStart: {
    left: 0,
  },
  fadeEnd: {
    right: 0,
  },
  fadeStep: {
    width: fadeStepWidth,
    backgroundColor: colors.surface,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingRight: spacing.m,
  },
  tab: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: spacing.m,
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.pressed,
    borderRadius: radius,
  },
  text: {
    ...type.bodyLarge,
    color: colors.inkMuted,
    fontWeight: "500",
  },
  textActive: {
    color: colors.accent,
    fontWeight: "700",
  },
  rule: {
    position: "absolute",
    left: spacing.m,
    right: spacing.m,
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },
  ruleActive: {
    backgroundColor: colors.accent,
  },
});
