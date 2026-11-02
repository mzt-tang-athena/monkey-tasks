import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "@/theme/tokens";
import { Button } from "./button";

export type BannerAction = {
  label: string;
  onPress: () => void;
  /** The name assistive tech reads, when the label alone is vague. */
  accessibilityLabel?: string;
};

const tones = {
  danger: { fill: colors.dangerSoft, ink: colors.danger },
  info: { fill: colors.accentSoft, ink: colors.accent },
} as const;

/**
 * A message on the page grid that leaves the screen usable: a failed
 * write, a note that needs repair. It has a tone, an optional title,
 * lines of text and an optional action. Extra content, such as one
 * block per broken note, goes in `children`. Assistive tech reads it
 * as an alert, politely, when it appears.
 */
export function Banner({
  tone,
  title,
  lines = [],
  action,
  children,
}: {
  tone: "danger" | "info";
  title?: string;
  lines?: string[];
  action?: BannerAction;
  children?: React.ReactNode;
}) {
  const { fill, ink } = tones[tone];
  return (
    <View
      role="alert"
      aria-live="polite"
      style={[styles.banner, { backgroundColor: fill }]}
    >
      <View style={styles.body}>
        {title != null ? (
          <Text style={[styles.title, { color: ink }]}>{title}</Text>
        ) : null}
        {lines.map((line, index) => (
          <Text key={index} style={[styles.line, { color: ink }]}>
            {line}
          </Text>
        ))}
        {children}
      </View>
      {action != null ? (
        <Button
          variant="text"
          tone={tone === "danger" ? "danger" : "accent"}
          label={action.label}
          accessibilityLabel={action.accessibilityLabel}
          onPress={action.onPress}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    borderRadius: radius,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  title: {
    ...type.eyebrow,
  },
  line: {
    ...type.meta,
  },
});
