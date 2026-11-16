import * as React from "react";
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardState } from "react-native-keyboard-controller";
import { MotionScrollView } from "@/components/motion/scroll-view";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { useClampedHeight } from "../hooks/use-clamped-height";
import { useSheetClock } from "../hooks/use-sheet-clock";

/**
 * A picker over the editor: one more sheet, stacked above it. The
 * header names the property and holds the optional Done control. The
 * scrim, Escape and Android back close it with no change.
 */
export function PickerSheet({
  open,
  onClose,
  title,
  doneLabel,
  onDone,
  doneDisabled = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  doneLabel?: string;
  onDone?: () => void;
  doneDisabled?: boolean;
  children: React.ReactNode;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardState((state) => state.height);
  const window = useWindowDimensions();
  const { mounted, progress } = useSheetClock(open);
  const cap = Math.max(240, window.height * 0.55 - keyboard - insets.top);
  const body = useClampedHeight(cap);
  if (!mounted) {
    return null;
  }
  return (
    <Sheet
      open={open}
      onDismiss={onClose}
      progress={progress}
      rideKeyboard
      scrim
      stacked
      label={title}
      closeLabel={`close ${title.toLowerCase()}`}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onDone == null ? null : (
          <Button
            variant="text"
            label={doneLabel ?? "Done"}
            accessibilityLabel={doneLabel ?? "done"}
            onPress={onDone}
            disabled={doneDisabled}
          />
        )}
      </View>
      {/* The body scrolls inside a cap, so a tall month grid and the
          keyboard never push the header off the top of the sheet. */}
      <MotionScrollView
        style={{ height: body.height, maxHeight: cap }}
        onContentSizeChange={body.onContentSizeChange}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </MotionScrollView>
    </Sheet>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44,
      gap: spacing.s,
    },
    title: {
      flex: 1,
      ...type.title,
      color: colors.ink,
    },
    body: {
      gap: spacing.m,
      paddingBottom: spacing.s,
    },
  }),
});
