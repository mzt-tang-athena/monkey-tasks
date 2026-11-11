import * as React from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions, type ViewProps } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDismiss } from "@/hooks/use-dismiss";
import { menuEntering, type MenuCorner } from "@/lib/motion/entrances";
import { useProgress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import { bottomBar, menuWidth, pageGutter, radiusFloating, shadows, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { Overlay } from "./overlay-host";
import { Pressable } from "./pressable";

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
const itemHeight = 44;

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
  kind = "menu",
}: {
  open: boolean;
  /** The view the menu opens from. */
  anchor: React.RefObject<React.ComponentRef<typeof View> | null>;
  onClose: () => void;
  /** Names the menu for assistive tech. */
  label: string;
  items: MenuItem[];
  align?: "start" | "end";
  /** A choice of one item is a radio group; actions are a menu. */
  kind?: "menu" | "radiogroup";
}) {
  const { styles } = useThemedStyles(makeStyles);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [box, setBox] = React.useState<Box | null>(null);
  // The measured height, once the menu has laid out. Until then the
  // item count gives it.
  const [height, setHeight] = React.useState<number | null>(null);

  // A shut menu forgets where it was. On a reopen the anchor may have
  // moved, and the new measure is async on a phone, so a kept box
  // would draw one frame at the old place.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setBox(null);
      setHeight(null);
    }
  }

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
  const opener = React.useRef<HTMLElement | null>(null);

  // A menu takes focus when it opens and gives it back to the control
  // that opened it. The first item takes focus from its own effect,
  // after the host's portal has put it in the document.
  React.useLayoutEffect(() => {
    if (!shown || Platform.OS !== "web") {
      return;
    }
    opener.current = document.activeElement as HTMLElement | null;
    return () => {
      const target = opener.current;
      opener.current = null;
      // The screen is inert until the host's own layout effect clears
      // it, so the focus waits one microtask.
      queueMicrotask(() => target?.focus?.());
    };
  }, [shown]);
  const backdrop = useProgress(shown, { ms: motion.ms.menu });
  const fade = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!shown) {
    return null;
  }

  const size = {
    width: menuWidth,
    height: height ?? items.length * itemHeight + spacing.xs * 2,
  };
  const place = placeMenu({ anchor: box, size, window, insets, align });
  // It grows out of the corner next to its anchor.
  const corner: MenuCorner = `${place.above ? "bottom" : "top"} ${align === "end" ? "right" : "left"}`;

  return (
    <>
      <Overlay layer="menuBackdrop" modal>
        <Animated.View style={[StyleSheet.absoluteFill, fade]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="close menu"
          />
        </Animated.View>
      </Overlay>
      <Overlay layer="menu">
        <Animated.View
          entering={menuEntering(corner)}
          role={kind}
          aria-label={label}
          tabIndex={-1}
          testID="menu"
          onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
          style={[styles.menu, { top: place.top, left: place.left }]}
        >
          <MenuFocus />
          {items.map((item) => (
            <MenuRow key={item.key} item={item} radio={kind === "radiogroup"} />
          ))}
        </Animated.View>
      </Overlay>
    </>
  );
}

/** Puts focus on the menu's first item. It sits inside the menu, so it
    mounts with the host's portal and can take focus after that commit. */
function MenuFocus() {
  const ref = React.useRef<React.ComponentRef<typeof View>>(null);
  React.useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }
    const node = ref.current as unknown as HTMLElement | null;
    const menu = node?.closest<HTMLElement>('[role="menu"], [role="radiogroup"]');
    const first = menu?.querySelector<HTMLElement>(
      '[role="menuitem"], [role="menuitemradio"], [role="radio"]',
    );
    if (first == null) {
      return;
    }
    // The menu's entrance is still on its first frame here, and a
    // browser will not focus a hidden node. Retry on the next frames,
    // until it takes, or give up after a short run.
    let frame = 0;
    let cancelled = false;
    const focus = () => {
      first.focus();
      frame += 1;
      if (!cancelled && document.activeElement !== first && frame < 10) {
        requestAnimationFrame(focus);
      }
    };
    focus();
    return () => {
      cancelled = true;
    };
  }, []);
  return <View ref={ref} />;
}

function MenuRow({ item, radio }: { item: MenuItem; radio: boolean }) {
  const { styles } = useThemedStyles(makeStyles);
  // ARIA allows a checked state only on a radio or a menuitemradio. An
  // action item carries none.
  const check = (
    item.selected === undefined ? "menuitem" : radio ? "radio" : "menuitemradio"
  ) as ViewProps["role"];
  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        pressed && !item.disabled && styles.itemPressed,
      ]}
      onPress={item.onPress}
      disabled={item.disabled}
      role={check}
      accessibilityLabel={item.label}
      aria-disabled={item.disabled ?? false}
      aria-checked={item.selected === undefined ? undefined : item.selected ?? false}
      tabIndex={0}
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

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
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
  }),
});
