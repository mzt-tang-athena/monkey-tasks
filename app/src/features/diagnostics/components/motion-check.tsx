import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { createDragSurface } from "@/components/motion/drag-surface";
import { radius, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * A drag on the motion surfaces for checks on a phone or an emulator:
 * hold the chip and drop it on a box. A drop names its box only when
 * the zones measured right at pickup, and the scroller around them
 * holds still while the chip moves.
 */
const Check = createDragSurface<string, string>();

const Result = React.createContext("");

export function MotionCheckRoot({ children }: { children: React.ReactNode }) {
  const [result, setResult] = React.useState("hold the chip, drop it on a box");
  return (
    <Check.Root
      onDrop={(chip, box) => setResult(`${chip} dropped on ${box}`)}
      renderGhost={(chip) => <Chip label={chip} />}
    >
      <Result.Provider value={result}>{children}</Result.Provider>
    </Check.Root>
  );
}

export function MotionCheck() {
  const { styles } = useThemedStyles(makeStyles);
  const result = React.useContext(Result);
  return (
    <View style={styles.section}>
      <Text style={styles.label}>motion check</Text>
      <Check.Source payload="chip" hold="row" testID="motion-check:chip" style={styles.source}>
        <Chip label="chip" />
      </Check.Source>
      {["A", "B"].map((box) => (
        <Check.Zone key={box} target={box} testID={`motion-check:${box}`} style={styles.box}>
          <Text style={styles.line}>{`box ${box}`}</Text>
        </Check.Zone>
      ))}
      <Text testID="motion-check:result" style={styles.line}>
        {result}
      </Text>
      {/* Room enough that the page scrolls, so a check can see that it
          holds still during a drag. */}
      <View style={styles.room} />
    </View>
  );
}

function Chip({ label }: { label: string }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    section: {
      gap: spacing.s,
    },
    label: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: "monospace",
      color: colors.inkFaint,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    line: {
      fontSize: 14,
      fontFamily: "monospace",
      color: colors.ink,
    },
    source: {
      alignSelf: "flex-start",
      borderRadius: radius,
    },
    chip: {
      backgroundColor: colors.accent,
      borderRadius: radius,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    chipText: {
      color: colors.onAccent,
      fontWeight: "600",
    },
    room: {
      height: 900,
    },
    box: {
      height: 72,
      justifyContent: "center",
      paddingHorizontal: spacing.m,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      borderRadius: radius,
    },
  }),
});
