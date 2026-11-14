import * as React from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import type { TextSegment } from "@/lib/journal/format";
import { type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * One line of journal text, with its `[[name]]` spans as links. The
 * brackets go and the name shows, as Obsidian shows it, so a bullet
 * reads as writing rather than vault source. A link opens the reference
 * preview. The other tags stay, quiet.
 *
 * The whole line is one `Text` with nested children, so a wrap keeps
 * the line's own `lineHeight` and the ruled paper stays true.
 */
export function LinkedText({
  segments,
  style,
  numberOfLines,
  testID,
  onReference,
}: {
  segments: TextSegment[];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  testID?: string;
  onReference: (name: string) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Text style={style} numberOfLines={numberOfLines} testID={testID}>
      {segments.map((segment, index) => {
        switch (segment.kind) {
          case "link":
            return (
              <Text
                key={index}
                style={styles.link}
                accessibilityRole="link"
                accessibilityLabel={`open reference ${segment.name}`}
                onPress={() => onReference(segment.name)}
              >
                {segment.text}
              </Text>
            );
          case "tag":
            return (
              <Text key={index} style={styles.tag}>
                {segment.text}
              </Text>
            );
          case "ate":
            return (
              <Text key={index} style={styles.ate}>
                {segment.text}
              </Text>
            );
          default:
            return <Text key={index}>{segment.text}</Text>;
        }
      })}
    </Text>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    link: {
      color: colors.accent,
      textDecorationLine: "underline",
    },
    tag: {
      color: colors.inkMuted,
    },
    ate: {
      color: colors.accent,
      fontWeight: "600",
    },
  }),
});
