import * as React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from "react-native";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import type { InboxColumns } from "@/lib/settings";
import {
  pageGutter,
  radius,
  spacing,
  touchTarget,
  type,
  type Palette,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** The words for how many notes show: all of them, or the matches. */
export function countLabel(shown: number, total: number): string {
  const noun = total === 1 ? "note" : "notes";
  return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`;
}

/**
 * The Inbox header: a search bar with the view button inside it, as
 * Keep draws it, and the note count under the bar. The screen draws no
 * title, so the count line is also its heading: a screen reader says
 * "Inbox Notes" first, then the count. The count is a polite live
 * region, so a search announces how many notes matched.
 *
 * The view button names the layout it switches to, not the one showing.
 */
export function InboxHeader({
  shown,
  total,
  query,
  onQueryChange,
  columns,
  onToggleColumns,
}: {
  shown: number;
  total: number;
  query: string;
  onQueryChange: (query: string) => void;
  columns: InboxColumns;
  onToggleColumns: () => void;
}) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const [focused, setFocused] = React.useState(false);
  const label = countLabel(shown, total);
  const next = columns === "two" ? "one column" : "two columns";
  return (
    <View testID="inbox-header" style={styles.header}>
      <View style={[styles.bar, focused && styles.barFocused]}>
        <View style={styles.lead}>
          <Icon name="search" color="inkMuted" />
        </View>
        <TextInput
          testID="inbox-search"
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search notes"
          placeholderTextColor={colors.inkFaint}
          selectionColor={colors.accent}
          aria-label="search notes"
          role="searchbox"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />
        {query === "" ? null : (
          <IconButton
            label="clear search"
            onPress={() => onQueryChange("")}
          >
            <Icon name="close" color="inkMuted" size={20} />
          </IconButton>
        )}
        <IconButton label={`switch to ${next}`} onPress={onToggleColumns}>
          <Icon
            name={columns === "two" ? "view-one" : "view-two"}
            color="inkMuted"
          />
        </IconButton>
      </View>
      <Text
        accessibilityRole="header"
        accessibilityLabel={`Inbox Notes, ${label}`}
        accessibilityLiveRegion="polite"
        style={styles.count}
      >
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    header: {
      paddingHorizontal: pageGutter,
      paddingTop: spacing.m,
      paddingBottom: spacing.s,
      gap: spacing.s,
    },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: radius,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.surface,
    },
    barFocused: {
      borderColor: colors.accent,
    },
    lead: {
      width: touchTarget,
      height: touchTarget,
      alignItems: "center",
      justifyContent: "center",
    },
    input: {
      flex: 1,
      minWidth: 0,
      minHeight: touchTarget,
      paddingVertical: spacing.s,
      ...type.body,
      color: colors.ink,
      ...Platform.select({
        web: { outlineStyle: "none" } as unknown as TextStyle,
        default: {},
      }),
    },
    count: {
      ...type.meta,
      color: colors.inkMuted,
    },
  }),
});
