import * as React from "react";
import { Platform, View } from "react-native";

/**
 * Focuses the first control inside it after mount, without scrolling
 * the page. A still gallery cannot press Tab, and the focus ring is the
 * state under review. A browser holds focus on one control at a time,
 * so only the last focused cell in the page shows its ring at rest.
 */
export function Focused({ children }: { children: React.ReactNode }) {
  const holder = React.useRef<React.ComponentRef<typeof View>>(null);

  React.useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }
    const node = holder.current as unknown as HTMLElement | null;
    const target = node?.querySelector<HTMLElement>(
      '[role="button"], [role="tab"], input',
    );
    target?.focus({ preventScroll: true });
  }, []);

  return <View ref={holder}>{children}</View>;
}
