import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, touchTarget, type } from "@/theme/tokens";
import { Icon, type IconName } from "./icon";

export type Segment<Key extends string> = {
  key: Key;
  /** The visible label. A segment shows its label or its icon. */
  label?: string;
  icon?: IconName;
  /** The name assistive tech reads. Defaults to the label. */
  accessibilityLabel?: string;
};

/**
 * A row of segments with one selected, such as Day, Week and Month.
 * A segment shows a label or an icon. The selected segment fills, and
 * its corners square off where it meets a neighbour. Each segment is
 * at least 44 by 44.
 */
export function SegmentedControl<Key extends string>({
  segments,
  selected,
  onSelect,
  label,
  stretch = false,
}: {
  segments: Segment<Key>[];
  selected: Key;
  onSelect: (key: Key) => void;
  /** Names the group for assistive tech. */
  label: string;
  /** The segments share the full width, as the planner's modes do. */
  stretch?: boolean;
}) {
  const last = segments.length - 1;
  return (
    <View style={styles.control} role="tablist" aria-label={label}>
      {segments.map((segment, index) => {
        const active = segment.key === selected;
        return (
          <Pressable
            key={segment.key}
            style={({ pressed }) => [
              styles.segment,
              stretch && styles.stretch,
              active && styles.active,
              pressed && !active && styles.pressed,
              active && corners(index, last),
            ]}
            onPress={() => onSelect(segment.key)}
            role="tab"
            aria-selected={active}
            accessibilityLabel={segment.accessibilityLabel ?? segment.label}
          >
            {segment.icon != null ? (
              <Icon name={segment.icon} color={active ? "onAccent" : "inkMuted"} />
            ) : (
              <Text style={[styles.text, active && styles.textActive]}>
                {segment.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The one place the inner corners square off: a selected segment
    keeps its radius only on the control's outer edge. */
function corners(index: number, last: number) {
  if (last === 0) {
    return null;
  }
  if (index === 0) {
    return styles.first;
  }
  return index === last ? styles.last : styles.middle;
}

const styles = StyleSheet.create({
  control: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 2,
  },
  segment: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius,
  },
  stretch: {
    flex: 1,
  },
  active: {
    backgroundColor: colors.accent,
  },
  pressed: {
    backgroundColor: colors.pressed,
  },
  first: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  middle: {
    borderRadius: 0,
  },
  last: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  text: {
    ...type.eyebrow,
    fontWeight: "500",
    color: colors.inkMuted,
  },
  textActive: {
    color: colors.onAccent,
    fontWeight: "600",
  },
});
