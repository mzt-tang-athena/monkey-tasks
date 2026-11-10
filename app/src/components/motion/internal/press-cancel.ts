import * as React from "react";
import { Platform } from "react-native";

/**
 * The one click a pan activation leaves behind, swallowed.
 *
 * A press target now presses with React Native's Pressable on the web,
 * so it fires from the browser's click (ADR 0046). A pointer that
 * travels and releases still makes the browser click: the drag's own
 * click, which must not press the row under the pointer. A surface arms
 * this guard when its pan activates. The click that follows the release
 * is stopped before React sees it, however late the browser sends it.
 * The next pointer or key down is a new gesture, so it disarms first
 * and the next real press is never swallowed (V10).
 *
 * The guard is per surface mount, so it dies with the surface and no
 * two surfaces can hold each other's click.
 */
export type PressCancel = {
  /** A pan activated: stop the click its release may make. */
  arm: () => void;
  /** The surface unmounted. */
  dispose: () => void;
};

function createPressCancel(): PressCancel {
  let armed = false;

  const onClick = (event: MouseEvent) => {
    if (!armed) {
      return;
    }
    disarm();
    // The drag's own click must not reach a press.
    event.stopImmediatePropagation();
    event.preventDefault();
  };
  // A press always begins with a pointer down, and a keyboard press with
  // a key down. Either one is a new gesture, not the drag's click.
  const onNewPress = () => disarm();

  function listen(on: boolean): void {
    if (on) {
      window.addEventListener("click", onClick, true);
      window.addEventListener("pointerdown", onNewPress, true);
      window.addEventListener("keydown", onNewPress, true);
    } else {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("pointerdown", onNewPress, true);
      window.removeEventListener("keydown", onNewPress, true);
    }
  }

  function disarm(): void {
    if (!armed) {
      return;
    }
    armed = false;
    listen(false);
  }

  return {
    arm() {
      if (Platform.OS !== "web" || armed) {
        return;
      }
      armed = true;
      listen(true);
    },
    dispose: disarm,
  };
}

/** The click guard one surface owns. */
export function usePressCancel(): PressCancel {
  const [cancel] = React.useState(createPressCancel);
  React.useEffect(() => () => cancel.dispose(), [cancel]);
  return cancel;
}
