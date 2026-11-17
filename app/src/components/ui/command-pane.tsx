import * as React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextStyle,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDismiss } from "@/hooks/use-dismiss";
import { useProgress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import {
  measure,
  radius,
  radiusFloating,
  shadows,
  spacing,
  touchTarget,
  type,
  type Palette,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { MotionScrollView } from "@/components/motion/scroll-view";
import { PullSurface } from "@/components/motion/pull";
import { Overlay } from "./overlay-host";
import { Pressable } from "./pressable";
import { useOpenerFocus } from "./use-opener-focus";

/** One row of the pane. The caller owns what a press does. */
export type CommandRow = {
  id: string;
  label: string;
  /** A quiet second word on the row, such as "Settings". */
  hint?: string;
  /** Extra words the search matches, without showing them. */
  keywords?: string[];
  onPress: () => void;
};

/**
 * A command palette that slides down from the top edge. The scrim, the
 * panel and the search are modal: the screen behind is inert and focus
 * moves into the search on open and back to the opener on close. Escape,
 * Android back, a press outside, a pull up or the Close button shuts it.
 *
 * The caller owns the rows, the recent order and what each row does.
 * The pane filters by label, hint and keyword, draws at most `limit`
 * rows, and keeps the search at the top while the rows scroll.
 */
export function CommandPane({
  open,
  onClose,
  label,
  placeholder = "Search commands",
  emptyLabel = "No commands",
  commands,
  limit = 12,
}: {
  open: boolean;
  onClose: () => void;
  /** Names the pane for assistive tech. */
  label: string;
  placeholder?: string;
  emptyLabel?: string;
  commands: CommandRow[];
  limit?: number;
}) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const input = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const [panelHeight, setPanelHeight] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  // The pane stays in the tree while its spring plays out.
  const [present, setPresent] = React.useState(open);
  if (open && !present) {
    setPresent(true);
  }
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setQuery("");
    }
  }

  useOpenerFocus(open);
  useDismiss(open, onClose);
  const progress = useProgress(open, {
    spring: motion.spring.pane,
    onSettled: (at) => {
      if (at === 0) {
        setPresent(false);
      }
    },
  });

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panel = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          -(panelHeight === 0 ? window.height : panelHeight) *
          (1 - progress.value),
      },
    ],
  }));

  if (!present) {
    return null;
  }

  const needle = query.trim().toLowerCase();
  const rows = commands
    .filter((row) => {
      if (needle === "") {
        return true;
      }
      return [row.label, row.hint ?? "", ...(row.keywords ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .slice(0, limit);

  return (
    <>
      <Overlay layer="sheetScrim" modal={open}>
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[styles.scrim, scrim]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="dismiss commands"
          />
        </Animated.View>
      </Overlay>
      <Overlay layer="sheet">
        <View
          pointerEvents="box-none"
          style={[styles.host, { paddingTop: insets.top }]}
        >
          <Animated.View
            role="dialog"
            aria-modal
            aria-label={label}
            tabIndex={-1}
            pointerEvents={open ? "auto" : "none"}
            onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
            style={[
              styles.panel,
              { maxHeight: window.height * 0.72 },
              panel,
            ]}
          >
            <SearchFocus open={open} input={input} />
            {/* The top block is the grab area: a pull up from the
                search row has room inside the screen, unlike one that
                starts on the title row at the very edge. */}
            <PullSurface direction="up" onPull={onClose} testID="command-pull">
              <View style={styles.head}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{label}</Text>
                  <Pressable
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="close commands"
                    style={({ pressed }) => [
                      styles.close,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.closeLabel}>Close</Text>
                  </Pressable>
                </View>
                <View style={styles.searchRow}>
                  <TextInput
                    ref={input}
                    value={query}
                    onChangeText={setQuery}
                    placeholder={placeholder}
                    placeholderTextColor={colors.inkFaint}
                    selectionColor={colors.accent}
                    aria-label={placeholder}
                    role="searchbox"
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    style={[styles.search, focused && styles.searchFocused]}
                    testID="command-search"
                  />
                </View>
              </View>
            </PullSurface>
            <MotionScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              contentContainerStyle={styles.rows}
            >
              {rows.map((row, index) => (
                <Pressable
                  key={row.id}
                  testID={`command:${row.id}`}
                  onPress={row.onPress}
                  role="button"
                  accessibilityLabel={
                    row.hint == null ? row.label : `${row.label} ${row.hint}`
                  }
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && styles.divider,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {row.label}
                  </Text>
                  {row.hint != null ? (
                    <Text style={styles.hint} numberOfLines={1}>
                      {` ${row.hint}`}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
              {rows.length === 0 ? (
                <Text style={styles.empty}>{emptyLabel}</Text>
              ) : null}
            </MotionScrollView>
          </Animated.View>
        </View>
      </Overlay>
    </>
  );
}

/** Moves focus into the search. It lives inside the panel, so it
    mounts with the overlay's portal and can focus the input after that
    commit, not before it. */
function SearchFocus({
  open,
  input,
}: {
  open: boolean;
  input: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
}) {
  React.useEffect(() => {
    if (open) {
      input.current?.focus?.();
    }
  }, [open, input]);
  return null;
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    scrim: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.scrim,
    },
    host: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
    },
    panel: {
      width: "100%",
      maxWidth: measure,
      backgroundColor: colors.surface,
      borderBottomLeftRadius: radiusFloating,
      borderBottomRightRadius: radiusFloating,
      borderWidth: StyleSheet.hairlineWidth,
      borderTopWidth: 0,
      borderColor: colors.hairline,
      paddingHorizontal: spacing.m,
      paddingBottom: spacing.s,
      gap: spacing.s,
      ...shadows.floating,
    },
    titleRow: {
      minHeight: touchTarget,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      paddingLeft: spacing.xs,
    },
    head: {
      gap: spacing.s,
    },
    title: {
      ...type.eyebrow,
      flex: 1,
      color: colors.inkMuted,
    },
    close: {
      minHeight: touchTarget,
      minWidth: touchTarget,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.s,
      borderRadius: radius,
    },
    closeLabel: {
      ...type.control,
      color: colors.inkMuted,
    },
    searchRow: {
      gap: spacing.xs,
    },
    search: {
      minHeight: touchTarget,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      borderRadius: radius,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.paper,
      ...type.body,
      color: colors.ink,
      // The caret and the accent edge carry focus, not a UA ring.
      ...Platform.select({
        web: { outlineStyle: "none" } as unknown as TextStyle,
        default: {},
      }),
    },
    searchFocused: {
      borderColor: colors.accent,
    },
    list: {
      flexGrow: 0,
      flexShrink: 1,
    },
    rows: {
      paddingBottom: spacing.xs,
    },
    row: {
      minHeight: touchTarget,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      paddingHorizontal: spacing.s,
      borderRadius: radius,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    rowLabel: {
      ...type.control,
      flex: 1,
      color: colors.ink,
    },
    hint: {
      ...type.caption,
      maxWidth: "45%",
      color: colors.inkMuted,
    },
    empty: {
      ...type.meta,
      color: colors.inkMuted,
      paddingHorizontal: spacing.s,
      paddingVertical: spacing.m,
    },
  }),
});
