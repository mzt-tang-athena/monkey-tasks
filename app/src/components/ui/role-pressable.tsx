// Gesture handler 3.3.0's web Pressable presses only a view whose role
// is "button" (`web/handlers/NativeViewGestureHandler.ts`, lines 87 to
// 92). A tab, a segment or a menu item keeps its own role, so on the web
// it presses with React Native's Pressable, which also takes Enter.
// None of them sits under a pan, so no pan needs to cancel them there.
// eslint-disable-next-line no-restricted-imports -- the web half, see above
import { Platform, Pressable as WebPressable } from "react-native";
import { Pressable } from "react-native-gesture-handler";

/** A press target whose role is not `button`: a tab, a segment or a
    menu item. Gesture handler's Pressable on native. */
export const RolePressable = (Platform.OS === "web" ? WebPressable : Pressable) as typeof Pressable;
