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
import { SheetGrab } from "@/components/motion/sheet-drag";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { useClampedHeight } from "@/hooks/use-clamped-height";
import { useSheetClock } from "@/hooks/use-sheet-clock";

/**
 * A picker over a sheet: one more sheet, stacked above it. The header
 * names the property and holds the optional Done control. The scrim,
 * Escape and Android back close it with no change.
 */
export function PickerSheet({
  open,
  onClose,
  title,
  doneLabel,
  onDone,
  doneDisabled = false,
  returnFocus,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  doneLabel?: string;
  onDone?: () => void;
  doneDisabled?: boolean;
  /** Where focus goes when the picker closes. */
  returnFocus?: () => void;
  children: React.ReactNode;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardState((state) => state.height);
  const window = useWindowDimensions();
  const { mounted, progress } = useSheetClock(open);
  // A picker holds no title above it, so it takes more of the window
  // than the editor does. The month grid and the time face then fit
  // without a scroll on a tall phone.
  const cap = Math.max(240, window.height * 0.8 - keyboard - insets.top);
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
      returnFocus={returnFocus}
    >
      <SheetGrab>
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
      </SheetGrab>
      {/* The body scrolls inside a cap, so a tall month grid and the
          keyboard never push the header off the top of the sheet. */}
      <MotionScrollView
        style={{ height: body.height, maxHeight: cap }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body} onLayout={body.onLayout}>
          {children}
        </View>
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
