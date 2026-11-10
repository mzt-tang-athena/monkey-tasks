// A press that no pager or drag source pans under (ADR 0046).
//
// Gesture handler's web press presses only a view whose role is
// "button" (`web/handlers/NativeViewGestureHandler.ts`, lines 87 to
// 92). It also drops a press when the view re-renders under the
// finger: 15 lost presses in 120 against React Native's 0. A tab, a
// segment, a menu item and a Button have no pan above them, so they
// take React Native's press on the web. A target inside a surface,
// where a pan must cancel a press, uses gesture handler's Pressable
// itself.
// eslint-disable-next-line no-restricted-imports -- the web half, see above
import { Platform, Pressable as WebPressable } from "react-native";
import { Pressable } from "react-native-gesture-handler";

/** A press target with no pan above it: a Button, a tab, a segment or
    a menu item. Gesture handler's Pressable on native. */
export const NoPanPressable = (Platform.OS === "web" ? WebPressable : Pressable) as typeof Pressable;
