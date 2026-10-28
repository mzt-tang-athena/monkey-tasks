import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget, type } from "@/theme/tokens";

/**
 * A row of tabs that scrolls sideways, with a rule under the selected
 * one. When the selection changes, the strip scrolls that tab into
 * view, so the name of the page on screen is never off the edge. The
 * user can still scroll it by hand. Each tab is at least 44 by 44.
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
  const strip = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Where each tab starts, from its layout. A tab keeps its place for
  // the session, so one measure is enough.
  const offsets = React.useRef<Record<string, number>>({});

  React.useEffect(() => {
    const x = offsets.current[selected];
    if (x == null) {
      return;
    }
    strip.current?.scrollTo({ x: Math.max(0, x - spacing.m), animated: true });
  }, [selected]);

  return (
    <ScrollView
      ref={strip}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.content}
      role="tablist"
      aria-label={label}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
