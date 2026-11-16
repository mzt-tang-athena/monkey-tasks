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
import { EdgeFade, edgeFadeWidth, fadedEdges } from "./edge-fade";
import { Pressable } from "./pressable";
import { radius, spacing, touchTarget, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

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
  const { styles } = useThemedStyles(makeStyles);
  const strip = React.useRef<MotionScrollRef | null>(null);
  // Reanimated reads the system switch once, at load.
  const reduced = useReducedMotion();
  // Where each tab starts, from its layout. A tab keeps its place for
  // the session, so one measure is enough.
  const offsets = React.useRef<Record<string, number>>({});
  const [frame, setFrame] = React.useState({ view: 0, content: 0, x: 0 });
  const fade = fadedEdges(frame);

  React.useEffect(() => {
    const x = offsets.current[selected];
    if (x == null) {
      return;
    }
    // Past the start fade, so the fade never pales the selected name.
    strip.current?.scrollTo({
      x: Math.max(0, x - edgeFadeWidth),
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
            <Pressable
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
            </Pressable>
          );
        })}
      </MotionScrollView>
      {fade.start ? <EdgeFade side="start" testID="tab-fade-start" /> : null}
      {fade.end ? <EdgeFade side="end" testID="tab-fade-end" /> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    strip: {
      flexShrink: 1,
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
  }),
});
