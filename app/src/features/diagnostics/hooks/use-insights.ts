import * as React from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  type ScaledSize,
} from "react-native";
import { useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";

/**
 * The runtime facts that decide where the app's chrome sits: the
 * safe-area insets, the window and screen sizes, and the keyboard
 * height the platform reports. The diagnostics screen shows them, so a
 * layout problem on a phone can be read rather than guessed at.
 */
export type Insights = {
  platform: string;
  insets: EdgeInsets;
  window: ScaledSize;
  screen: ScaledSize;
  /** The keyboard height the platform last reported, in dp. */
  keyboardHeight: number;
  /** How many keyboard events arrived. */
  keyboardEvents: number;
  /** The window height while no keyboard was up. */
  baseHeight: number;
};

export function useInsights(): Insights {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const [keyboardEvents, setKeyboardEvents] = React.useState(0);
  const [baseHeight, setBaseHeight] = React.useState(() =>
    Dimensions.get("window").height,
  );

  React.useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardEvents((count) => count + 1);
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
      setBaseHeight(Dimensions.get("window").height);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return {
    platform: `${Platform.OS} ${Platform.Version}`,
    insets,
    window: Dimensions.get("window"),
    screen: Dimensions.get("screen"),
    keyboardHeight,
    keyboardEvents,
    baseHeight,
  };
}

/** The insights as plain lines, for a text screen. */
export function insightLines(insights: Insights): string[] {
  const { insets, window, screen, keyboardHeight, keyboardEvents } = insights;
  return [
    `platform ${insights.platform}`,
    `insets t${insets.top} r${insets.right} b${insets.bottom} l${insets.left}`,
    `window ${window.width}x${window.height} @${window.scale}`,
    `screen ${screen.width}x${screen.height} @${screen.scale}`,
    `base height ${insights.baseHeight}`,
    `keyboard ${keyboardHeight}dp, ${keyboardEvents} event(s)`,
  ];
}
