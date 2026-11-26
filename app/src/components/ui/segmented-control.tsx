import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Pressable } from "./pressable";
import { radius, touchTarget, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
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
 * its corners square off where it meets a neighbour. Each segment's
 * press target is at least 44 by 44. The pill it draws is shorter, and
 * the target's spare height overlaps what sits above and below.
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
  const { styles } = useThemedStyles(makeStyles);
  const last = segments.length - 1;
  return (
    <View style={styles.control} role="tablist" aria-label={label}>
      {segments.map((segment, index) => {
        const active = segment.key === selected;
        return (
          <Pressable
            key={segment.key}
            style={[styles.segment, stretch && styles.stretch]}
            onPress={() => onSelect(segment.key)}
            role="tab"
            aria-selected={active}
            accessibilityLabel={segment.accessibilityLabel ?? segment.label}
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.pill,
                  active && styles.active,
                  pressed && !active && styles.pressed,
                  active && corners(index, last, styles),
                ]}
              >
                {segment.icon != null ? (
                  <Icon name={segment.icon} color={active ? "onAccent" : "inkMuted"} />
                ) : (
                  <Text style={[styles.text, active && styles.textActive]}>
                    {segment.label}
                  </Text>
                )}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The one place the inner corners square off: a selected segment
    keeps its radius only on the control's outer edge. */
function corners(
  index: number,
  last: number,
  styles: { first: ViewStyle; middle: ViewStyle; last: ViewStyle },
) {
  if (last === 0) {
    return null;
  }
  if (index === 0) {
    return styles.first;
  }
  return index === last ? styles.last : styles.middle;
}

/** The pill's height. The press target keeps `touchTarget`. */
const pillHeight = 36;
const inset = 2;
const spare = (touchTarget - pillHeight) / 2;

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    control: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      padding: inset,
      alignItems: "center",
      height: pillHeight + 2 * inset + 2 * StyleSheet.hairlineWidth,
    },
    segment: {
      minHeight: touchTarget,
      minWidth: touchTarget,
      paddingVertical: spare,
    },
    pill: {
      flexGrow: 1,
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
  }),
});
