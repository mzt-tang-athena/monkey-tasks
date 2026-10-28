import * as React from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type TextStyle,
} from "react-native";
import { useKeyboardAnimation } from "react-native-keyboard-controller";
import type { CaptureDraft } from "@/features/capture/hooks/use-capture-draft";
import { targetLabel } from "@/features/capture/lib/chip-labels";
import { CaptureChips } from "./capture-chips";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import {
  captureText,
  colors,
  fonts,
  spacing,
  radiusFloating,
  sheetGap,
  sheetMaxShare,
  sheetReserve,
} from "@/theme/tokens";

// The sheet input carries focus by caret and placeholder alone: no
// app ring, and the browser's own focus outline is suppressed on
// web so no UA ring can appear either.
const noFocusOutline = Platform.select({
  web: { outlineStyle: "none" } as unknown as TextStyle,
  default: {},
});

// The input follows its text both ways (grow and shrink) natively
// via CSS field sizing; the max-height cap scrolls past the cap.
const autoSizedInput = Platform.select({
  web: { fieldSizing: "content" } as unknown as TextStyle,
  default: {},
});

/** A distance the platform or the sheet's own clock can drive. */
type AnimatedLength =
  | number
  | Animated.Value
  | Animated.AnimatedInterpolation<number>;

/**
 * The floating capture sheet: a scrim over the content, a dock that
 * rides the keyboard, and the panel with the input, the parse chips
 * and the action row. Everything that changes lives in the draft or
 * in the props; the sheet only renders them. The entrance progress
 * is shared with the caller so the sheet and the navbar move on one
 * clock, and the dock bottom arrives already interpolated.
 */
export function CaptureSheet({
  open,
  onClose,
  draft,
  bottom,
  scrim,
  progress,
}: {
  open: boolean;
  onClose: () => void;
  draft: CaptureDraft;
  bottom: AnimatedLength;
  scrim?: { bottom: AnimatedLength; height: number } | null;
  progress?: Animated.Value;
}) {
  const window = useWindowDimensions();
  // The input's cap: sheetMaxShare of the window, less the room the
  // keyboard and the panel's fixed chrome need. The input follows its
  // text both ways inside it.
  const maxInputHeight = Math.max(
    captureText.minHeight,
    Math.round(
      Math.min(window.height * sheetMaxShare, window.height - sheetReserve),
    ),
  );
  // The keyboard's height as an Animated node the platform moves frame
  // by frame. The dock rides it directly, so the sheet and the
  // keyboard travel together instead of the sheet waiting for a
  // reported height. Android runs edge to edge and never resizes the
  // window for the keyboard, so this node is the only source of it.
  const { height: keyboardHeight } = useKeyboardAnimation();
  // The input, so send can drop focus, and with it the keyboard, in
  // the same frame the sheet starts to close.
  const inputRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);

  const send = () => {
    if (!draft.canSend) {
      return;
    }
    // The keyboard and the sheet leave in one frame: blur starts the
    // keyboard down, close starts the sheet down, and the write runs
    // behind both of them.
    inputRef.current?.blur();
    onClose();
    draft.send();
  };

  const scrimOpacity = progress ?? (open ? 1 : 0);
  const sheetMotion =
    progress == null
      ? { opacity: open ? 1 : 0 }
      : {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        };

  return (
    <>
      {/* Scrim over the content; it follows the navbar's collapse. */}
      {scrim == null ? null : (
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[
            styles.scrim,
            {
              bottom: scrim.bottom,
              height: scrim.height,
              opacity: scrimOpacity,
            },
          ]}
        >
          <Pressable
            style={styles.scrimFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="close capture"
          />
        </Animated.View>
      )}

      {/* The floating sheet, docked where the caller places it. The
          outer view carries the keyboard, the inner one the dock's
          placement, so the two drivers never meet in one style. */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.sheetLift,
          {
            height: window.height,
            transform: [{ translateY: keyboardHeight }],
          },
        ]}
      >
        <Animated.View
          pointerEvents="box-none"
          style={[styles.sheetDock, { bottom }]}
        >
          <Animated.View
            pointerEvents={open ? "auto" : "none"}
            style={[styles.sheet, sheetMotion]}
          >
            <TextInput
              ref={inputRef}
              style={[
                styles.sheetInput,
                autoSizedInput,
                { maxHeight: maxInputHeight },
              ]}
              placeholder="Add a task"
              placeholderTextColor={colors.inkFaint}
              value={draft.text}
              onChangeText={draft.setText}
              onSubmitEditing={send}
              returnKeyType="send"
              // A multiline input defaults to newline on Android, which
              // swallows the send action. Submit keeps the sheet able to
              // grow and still fires onSubmitEditing.
              submitBehavior="submit"
              multiline
              autoFocus
              selectionColor={colors.accent}
            />
            <CaptureChips parsed={draft.parsed} />
            <View style={styles.sheetActions}>
              <Pill
                label={targetLabel(draft.target)}
                onPress={draft.cycleTarget}
                accessibilityLabel="target list"
              />
              <View style={styles.sheetSpacer} />
              <Button
                label="send task"
                onPress={send}
                shape="circle"
                disabled={!draft.canSend}
                busy={draft.sending}
                hitSlop={6}
                accessibilityLabel="send task"
              />
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  // Scrim: covers the content above the navbar only.
  scrim: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    backgroundColor: colors.scrim,
  },
  scrimFill: {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },

  // The floating capture sheet.
  // The sheet's dock: absolute placement lives here; the visual
  // panel is the child.
  sheetDock: {
    position: "absolute" as const,
    left: spacing.m,
    right: spacing.m,
  },
  // The keyboard lift: the dock rides this view, which carries nothing
  // but the keyboard's own height, so the two drivers never meet in
  // one style.
  sheetLift: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radiusFloating,
    padding: spacing.m,
    gap: sheetGap,
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  sheetInput: {
    fontSize: captureText.size,
    lineHeight: captureText.line,
    fontFamily: fonts.body,
    color: colors.ink,
    minHeight: captureText.minHeight,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.m,
    ...noFocusOutline,
  },
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  sheetSpacer: {
    flex: 1,
  },
});
