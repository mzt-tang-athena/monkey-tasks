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
import type { PageFollow } from "@/components/motion/page-follow";
import { TabUnderline } from "@/components/motion/tab-underline";
import type { MarkPlace } from "@/lib/motion/mark-math";
import { EdgeFade, fadedEdges, fadeReach } from "./edge-fade";
import { Pressable } from "./pressable";
import { radius, spacing, touchTarget, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** A tab's padding, and the space between two tabs. */
const tabSpace = { inset: spacing.m, gap: spacing.xs };

/**
 * A row of tabs that scrolls sideways, with a rule under the selected
 * one. When the selection changes, the strip scrolls that tab into
 * view, so the name of the page on screen is never off the edge. The
 * user can still scroll it by hand. Each tab is at least 44 by 44.
 * Where more tabs wait past an edge, the edge fades, so a clipped
 * name reads as "more this way" and not as a bug. The fade ends on the
 * gap between two tabs, so no name shows cut. It paints the surface
 * color, so the strip belongs on a surface. With a page follow
 * from a pager, the rule tracks the swipe (ADR 0046).
 */
export function TabStrip({
  tabs,
  selected,
  onSelect,
  label,
  follow,
}: {
  tabs: string[];
  selected: string;
  onSelect: (tab: string) => void;
  /** Names the tab list for assistive tech. */
  label: string;
  /** The pager whose swipe the rule follows. */
  follow?: PageFollow;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const strip = React.useRef<MotionScrollRef | null>(null);
  // Reanimated reads the system switch once, at load.
  const reduced = useReducedMotion();
  // Where each tab sits in the content, from its layout. A tab keeps
  // its place for the session, so one measure is enough.
  const [places, setPlaces] = React.useState<Record<string, MarkPlace>>({});
  const [frame, setFrame] = React.useState({ view: 0, content: 0, x: 0 });
  const fade = fadedEdges(frame);

  const selectedX = places[selected]?.x;
  React.useEffect(() => {
    if (selectedX == null) {
      return;
    }
    // The name before the selected tab just clears the edge.
    strip.current?.scrollTo({
      x: Math.max(0, selectedX - tabSpace.inset - tabSpace.gap),
      animated: !reduced,
    });
  }, [selectedX, reduced]);

  const boxes = React.useMemo(
    () => tabs.map((name) => places[name] ?? null),
    [tabs, places],
  );
  const index = Math.max(0, tabs.indexOf(selected));

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
                const { x, width } = event.nativeEvent.layout;
                setPlaces((current) => {
                  const place = current[name];
                  if (place?.x === x && place.width === width) {
                    return current;
                  }
                  return { ...current, [name]: { x, width } };
                });
              }}
              role="tab"
              aria-selected={active}
            >
              <Text style={[styles.text, active && styles.textActive]}>{name}</Text>
            </Pressable>
          );
        })}
        <TabUnderline
          follow={follow}
          selected={index}
          boxes={boxes}
          inset={spacing.m}
          testID="tab-underline"
        />
      </MotionScrollView>
      {fade.start ? (
        <EdgeFade
          side="start"
          reach={fadeReach("start", frame, boxes, tabSpace)}
          testID="tab-fade-start"
        />
      ) : null}
      {fade.end ? (
        <EdgeFade
          side="end"
          reach={fadeReach("end", frame, boxes, tabSpace)}
          testID="tab-fade-end"
        />
      ) : null}
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
  }),
});
