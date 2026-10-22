import { Alert, Platform } from "react-native";

type ErrorUtilsLike = {
  setGlobalHandler: (handler: (error: unknown) => void) => void;
};

/**
 * Turn an uncaught error into a readable dialog instead of a dead app.
 * A release build otherwise closes on the first exception and the
 * report is "it crashed", which is not enough to fix anything.
 *
 * The dialog names the error and the first frames of the stack. The app
 * keeps running, so the user can carry on after dismissing it.
 */
export function installErrorAlert(): void {
  if (Platform.OS === "web") {
    return;
  }
  // React Native installs ErrorUtils on the global. TypeScript has no
  // declaration for it, and the library exposes no public type.
  const scope = globalThis as unknown as { ErrorUtils?: ErrorUtilsLike };
  const utils = scope.ErrorUtils;
  if (utils == null) {
    return;
  }
  utils.setGlobalHandler((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? "") : "";
    Alert.alert(
      "Something broke",
      `${message}\n\n${stack.split("\n").slice(0, 6).join("\n")}`,
      [{ text: "OK" }],
      { cancelable: true },
    );
  });
}
