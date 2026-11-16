import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { bottomBar, radii, type Palette } from "@/theme/tokens";
import { useTheme } from "@/theme/theme-provider";

export type IconName =
  | "list"
  | "calendar"
  | "calendar-mini"
  | "clock-mini"
  | "plus"
  | "sort"
  | "more"
  | "rows"
  | "pill"
  | "repeat"
  | "grip"
  | "grip-bars"
  | "settings"
  | "chevron-right"
  | "chevron-down"
  | "bell"
  | "note"
  | "close"
  | "check";

/** How a glyph draws: a hollow stroke at rest, or a solid mark when the
    control it sits in is selected. */
export type GlyphWeight = "outline" | "fill";

/**
 * The app's glyphs, built from views. There is no icon font. Each
 * glyph keeps the size it has where it first appeared, and takes its
 * color from a palette key. An icon is decoration: the control around
 * it carries the name for assistive tech.
 */
export function Icon({
  name,
  color = "inkMuted",
  weight = "outline",
}: {
  name: IconName;
  /** Only the sort and overflow glyphs carry a filled form. */
  weight?: GlyphWeight;
  color?: keyof Palette;
}) {
  const { colors } = useTheme();
  const tint = colors[color];
  const fill = { backgroundColor: tint };
  const edge = { borderColor: tint };
  const solid = weight === "fill" && (name === "sort" || name === "more");
  return (
    <View
      testID={`icon:${name}${solid ? ":fill" : ""}`}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {glyph(name, solid, fill, edge, tint)}
    </View>
  );
}

function glyph(
  name: IconName,
  solid: boolean,
  fill: { backgroundColor: string },
  edge: { borderColor: string },
  tint: string,
): React.ReactNode {
  switch (name) {
    // The Lists tab: three lines, the middle one short.
    case "list":
      return (
        <View style={styles.list}>
          <View style={[styles.listLine, fill, { width: bottomBar.glyph }]} />
          <View style={[styles.listLine, fill, { width: bottomBar.glyph - 6 }]} />
          <View style={[styles.listLine, fill, { width: bottomBar.glyph }]} />
        </View>
      );
    // The Planner tab: a page with a header band and one day marked.
    case "calendar":
      return (
        <View style={[styles.calendar, edge]}>
          <View style={[styles.calendarTop, fill]} />
          <View style={[styles.calendarDot, fill]} />
        </View>
      );
    // The date chip in the capture sheet.
    case "calendar-mini":
      return (
        <View style={[styles.calendarMini, edge]}>
          <View style={[styles.calendarMiniTop, fill]} />
          <View style={[styles.calendarMiniDot, fill]} />
        </View>
      );
    // The time chip in the capture sheet: a face with two hands.
    case "clock-mini":
      return (
        <View style={[styles.clockMini, edge]}>
          <View style={[styles.clockHand, fill]} />
          <View style={[styles.clockHandFlat, fill]} />
        </View>
      );
    // The Add button.
    case "plus":
      return (
        <View style={styles.plus}>
          <View style={[styles.plusBar, fill]} />
          <View style={[styles.plusStem, fill]} />
        </View>
      );
    // The sort control: three bars, shortest last.
    case "sort":
      return (
        <View style={styles.sort}>
          {[16, 11, 6].map((width) => (
            <View
              key={width}
              style={[
                styles.sortBar,
                { width },
                solid ? fill : [styles.sortOutline, edge],
              ]}
            />
          ))}
        </View>
      );
    // The overflow control: three dots in a column.
    case "more":
      return (
        <View style={styles.more}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={[
                styles.moreDot,
                solid ? fill : [styles.moreOutline, edge],
              ]}
            />
          ))}
        </View>
      );
    // The planner's list form.
    case "rows":
      return (
        <View style={styles.rows}>
          <View style={[styles.rowsBar, fill]} />
          <View style={[styles.rowsBar, styles.rowsBarShort, fill]} />
          <View style={[styles.rowsBar, fill]} />
        </View>
      );
    // The planner's pill form.
    case "pill":
      return <View style={[styles.pill, edge]} />;
    case "repeat":
      return <Text style={[styles.repeat, { color: tint }]}>{"↻"}</Text>;
    // The reorder handle: two columns of three dots.
    case "grip":
      return (
        <View style={styles.grip}>
          {[0, 1, 2].map((row) => (
            <View key={row} style={styles.gripRow}>
              <View style={[styles.gripDot, fill]} />
              <View style={[styles.gripDot, fill]} />
            </View>
          ))}
        </View>
      );
    // A pill's drag handle: two short bars.
    case "grip-bars":
      return (
        <View style={styles.gripBars}>
          <View style={[styles.gripBar, fill]} />
          <View style={[styles.gripBar, fill]} />
        </View>
      );
    // The settings control: a ring with four teeth.
    case "settings":
      return (
        <View style={styles.settings}>
          <View style={[styles.settingsRing, edge]} />
          <View style={[styles.settingsToothTop, fill]} />
          <View style={[styles.settingsToothBottom, fill]} />
          <View style={[styles.settingsToothLeft, fill]} />
          <View style={[styles.settingsToothRight, fill]} />
        </View>
      );
    // An open-right chevron: the same turned square, facing a row's
    // next screen.
    case "chevron-right":
      return (
        <View style={styles.chevronBox}>
          <View style={[styles.chevron, styles.chevronRight, edge]} />
        </View>
      );
    // An open-down chevron: two strokes of a turned square.
    case "chevron-down":
      return (
        <View style={styles.chevronBox}>
          <View style={[styles.chevron, edge]} />
        </View>
      );
    // The editor's alerts: a dome on a rim, with the clapper below.
    case "bell":
      return (
        <View style={styles.bell}>
          <View style={[styles.bellDome, edge]} />
          <View style={[styles.bellRim, fill]} />
          <View style={[styles.bellClapper, fill]} />
        </View>
      );
    // The editor's note: a page with two lines of text.
    case "note":
      return (
        <View style={[styles.note, edge]}>
          <View style={[styles.noteLine, fill]} />
          <View style={[styles.noteLine, styles.noteLineShort, fill]} />
        </View>
      );
    // A clear or remove control: two crossed strokes.
    case "close":
      return (
        <View style={styles.close}>
          <View style={[styles.closeStroke, styles.closeLeft, fill]} />
          <View style={[styles.closeStroke, styles.closeRight, fill]} />
        </View>
      );
    // A chosen item: the two strokes of a turned corner.
    case "check":
      return (
        <View style={styles.chevronBox}>
          <View style={[styles.check, edge]} />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  bell: {
    width: 14,
    height: 14,
    alignItems: "center",
  },
  bellDome: {
    width: 10,
    height: 9,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  bellRim: {
    width: 13,
    height: 1.5,
    borderRadius: 1,
  },
  bellClapper: {
    width: 3,
    height: 2,
    borderBottomLeftRadius: 1.5,
    borderBottomRightRadius: 1.5,
  },

  note: {
    width: 12,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 2,
    paddingHorizontal: 2,
    paddingTop: 3,
    gap: 2,
  },
  noteLine: {
    height: 1.5,
    borderRadius: 1,
  },
  noteLineShort: {
    width: 3,
  },

  close: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  closeStroke: {
    position: "absolute",
    width: 13,
    height: 1.5,
    borderRadius: 1,
  },
  closeLeft: {
    transform: [{ rotate: "45deg" }],
  },
  closeRight: {
    transform: [{ rotate: "-45deg" }],
  },

  // The bottom and right edges of a tall box, turned into a tick.
  check: {
    width: 5,
    height: 9,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ translateY: -1.5 }, { rotate: "45deg" }],
  },

  list: {
    height: 16,
    alignItems: "flex-start",
    gap: 4,
  },
  listLine: {
    height: 2.5,
    borderRadius: 1.25,
  },

  calendar: {
    width: bottomBar.glyph,
    height: bottomBar.glyph,
    borderWidth: 1.5,
    borderRadius: 5,
    overflow: "hidden",
  },
  calendarTop: {
    height: 5,
    width: "100%",
  },
  // Placed inside the frame: under the band, in from the left.
  calendarDot: {
    position: "absolute",
    left: 4,
    top: 8.5,
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  calendarMini: {
    width: 11,
    height: 11,
    borderWidth: 1.5,
    borderRadius: 3,
    overflow: "hidden",
  },
  calendarMiniTop: {
    height: 3,
    width: "100%",
  },
  calendarMiniDot: {
    position: "absolute",
    left: 2,
    top: 5,
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },

  clockMini: {
    width: 11,
    height: 11,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  clockHand: {
    position: "absolute",
    left: 4,
    top: 1.5,
    width: 1.5,
    height: 4,
    borderRadius: 1,
  },
  clockHandFlat: {
    position: "absolute",
    left: 5.5,
    top: 4,
    width: 3,
    height: 1.5,
    borderRadius: 1,
  },

  plus: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  plusBar: {
    width: 16,
    height: 2.5,
    borderRadius: 1.25,
  },
  plusStem: {
    position: "absolute",
    left: 7.75,
    top: 1,
    width: 2.5,
    height: 16,
    borderRadius: 1.25,
  },

  sort: {
    height: bottomBar.glyph,
    alignItems: "flex-end",
    gap: 2.5,
  },
  // A 5pt stroke leaves room for the hollow form's 1.5pt border.
  sortBar: {
    height: 5,
    borderRadius: 2.5,
  },
  sortOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
  },

  more: {
    height: bottomBar.glyph,
    alignItems: "center",
    gap: 2.5,
  },
  moreDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  moreOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.25,
  },

  rows: {
    alignItems: "flex-start",
    gap: 3,
  },
  rowsBar: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  rowsBarShort: {
    width: 9,
  },

  pill: {
    width: 16,
    height: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },

  repeat: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
  },

  grip: {
    gap: 3,
  },
  gripRow: {
    flexDirection: "row",
    gap: 4,
  },
  gripDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },

  gripBars: {
    alignItems: "center",
    gap: 2,
  },
  gripBar: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },

  settings: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsRing: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    borderWidth: 2,
  },
  settingsToothTop: {
    position: "absolute",
    left: 8,
    top: 0,
    width: 2,
    height: 5,
    borderRadius: 1,
  },
  settingsToothBottom: {
    position: "absolute",
    left: 8,
    bottom: 0,
    width: 2,
    height: 5,
    borderRadius: 1,
  },
  settingsToothLeft: {
    position: "absolute",
    top: 8,
    left: 0,
    width: 5,
    height: 2,
    borderRadius: 1,
  },
  settingsToothRight: {
    position: "absolute",
    top: 8,
    right: 0,
    width: 5,
    height: 2,
    borderRadius: 1,
  },

  chevronBox: {
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  // The right and bottom edges of a 6 pt square, turned to point down
  // and lifted so the point sits on the box's center line.
  chevron: {
    width: 6,
    height: 6,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ translateY: -1.5 }, { rotate: "45deg" }],
  },
  chevronRight: {
    transform: [{ translateX: -1.5 }, { rotate: "-45deg" }],
  },
});
