import * as React from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDismiss } from "@/hooks/use-dismiss";
import { useMenuEntrance } from "@/lib/motion";
import {
  bottomBar,
  colors,
  menuWidth,
  pageGutter,
  radiusFloating,
  shadows,
  spacing,
  type,
} from "@/theme/tokens";
import { Overlay } from "./overlay-host";

export type MenuItem = {
  key: string;
  label: string;
  /** A second, quieter line under the label. */
  hint?: string;
  /** Draws a check: the item is the current choice. Leave it out for
      an action, which has no checked state. */
  selected?: boolean;
  tone?: "danger";
  disabled?: boolean;
  onPress: () => void;
};

type Box = { x: number; y: number; width: number; height: number };

/** The space between the anchor and the menu. */
const anchorGap = spacing.xs;
/** Each item's height. A label with a hint still fits it. */
const itemHeight = 40;

/**
 * Where a menu goes. It opens below its anchor, and flips above when
 * it would cross the bottom bar or the bottom safe area. It lines up
 * with the anchor's right edge ("end") or left edge ("start"), and
 * both sides stay inside the page gutter.
 */
export function placeMenu({
  anchor,
  size,
  window,
  insets,
  align,
}: {
  anchor: Box;
  size: { width: number; height: number };
  window: { width: number; height: number };
  insets: { top: number; bottom: number };
  align: "start" | "end";
}): { top: number; left: number; above: boolean } {
  // The bottom bar sits above the bottom safe area: its row plus its
  // own padding above and below.
  const floor =
    window.height - insets.bottom - (bottomBar.row + spacing.s * 2);
  const below = anchor.y + anchor.height + anchorGap;
  const up = anchor.y - anchorGap - size.height;
  const above = below + size.height > floor && up >= insets.top;
  const top = above ? up : below;

  const wanted = align === "end" ? anchor.x + anchor.width - size.width : anchor.x;
  const left = Math.max(
    pageGutter,
    Math.min(wanted, window.width - pageGutter - size.width),
  );
  return { top, left, above };
}

/**
 * A menu that opens from an anchor. The anchor is measured when the
 * menu opens and again when the window changes size. The backdrop,
 * Android back and Escape on the web close it. It draws through the
 * `OverlayHost`, so it floats above every screen and the bottom bar.
 */
export function Menu({
  open,
  anchor,
  onClose,
  label,
  items,
  align = "end",
}: {
  open: boolean;
  /** The view the menu opens from. */
  anchor: React.RefObject<React.ComponentRef<typeof View> | null>;
  onClose: () => void;
  /** Names the menu for assistive tech. */
  label: string;
  items: MenuItem[];
  align?: "start" | "end";
}) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [box, setBox] = React.useState<Box | null>(null);
  // The measured height, once the menu has laid out. Until then the
  // item count gives it.
  const [height, setHeight] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    anchor.current?.measureInWindow((x, y, width, h) => {
      setBox({ x, y, width, height: h });
    });
  }, [open, anchor, window.width, window.height]);

  useDismiss(open, onClose);
  const shown = open && box != null;
  const progress = useMenuEntrance(shown);

  if (!shown) {
    return null;
  }

  const size = {
    width: menuWidth,
    height: height ?? items.length * itemHeight + spacing.xs * 2,
  };
  const place = placeMenu({ anchor: box, size, window, insets, align });
  const origin = `${place.above ? "bottom" : "top"} ${align === "end" ? "right" : "left"}`;

  return (
    <>
      <Overlay layer="menuBackdrop" modal>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="close menu"
        />
      </Overlay>
      <Overlay layer="menu">
        <Animated.View
          role="menu"
          aria-label={label}
          testID="menu"
          onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
          style={[
            styles.menu,
            {
              top: place.top,
              left: place.left,
              opacity: progress,
              // It grows out of the corner next to its anchor.
              transformOrigin: origin,
              transform: [
                {
                  scale: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {items.map((item) => (
            <MenuRow key={item.key} item={item} />
          ))}
        </Animated.View>
      </Overlay>
    </>
  );
}

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        pressed && !item.disabled && styles.itemPressed,
      ]}
      onPress={item.onPress}
      disabled={item.disabled}
      role="menuitem"
      accessibilityLabel={item.label}
      aria-disabled={item.disabled ?? false}
      aria-checked={item.selected}
    >
      <View style={styles.itemText}>
        <Text
          style={[
            styles.label,
            item.tone === "danger" && styles.danger,
            item.selected === true && styles.selected,
            item.disabled === true && styles.disabled,
          ]}
        >
          {item.label}
        </Text>
        {item.hint != null ? <Text style={styles.hint}>{item.hint}</Text> : null}
      </View>
      {item.selected === true ? <Text style={styles.check}>{"✓"}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    width: menuWidth,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radiusFloating,
    paddingVertical: spacing.xs,
    ...shadows.floating,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    minHeight: itemHeight,
    paddingHorizontal: spacing.m,
  },
  itemPressed: {
    backgroundColor: colors.pressed,
  },
  itemText: {
    flex: 1,
    gap: 1,
  },
  label: {
    ...type.control,
    color: colors.ink,
  },
  danger: {
    color: colors.danger,
  },
  selected: {
    color: colors.accent,
    fontWeight: "600",
  },
  disabled: {
    color: colors.inkFaint,
  },
  hint: {
    ...type.caption,
    color: colors.inkMuted,
  },
  check: {
    ...type.meta,
    color: colors.accent,
  },
});
