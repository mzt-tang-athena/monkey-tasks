import * as React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { SegmentedControl, type Segment } from "@/components/ui/segmented-control";
import { SectionHeader } from "@/components/ui/section-header";
import { MotionScrollView } from "@/components/motion/scroll-view";
import { useVault } from "@/lib/vault/vault-provider";
import { useSetting } from "@/lib/settings-store";
import type { SortMode, TaskForm } from "@/lib/settings";
import {
  measure,
  pageGutter,
  radius,
  spacing,
  touchTarget,
  type,
  type Palette,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { ThemePicker } from "./components/theme-picker";

const REPO = "https://github.com/mzt-tang-athena/monkey-tasks";

const sortOptions: Segment<SortMode>[] = [
  { key: "manual", label: "My order" },
  { key: "due", label: "Due date" },
];

const formOptions: Segment<TaskForm>[] = [
  { key: "rows", label: "Rows" },
  { key: "pills", label: "Chips" },
];

/** The build channel. EAS does not put its channel on the manifest, so
    the dev flag is the split the app can see. */
function buildChannel(): string {
  return typeof __DEV__ !== "undefined" && __DEV__ ? "development" : "production";
}

/**
 * The settings screen. It owns the palette picker and the two settings
 * the Lists and Planner screens share. Every value reads and writes
 * `lib/settings.ts`; the theme goes through its provider, and the two
 * screen settings go through the live store so a mounted screen
 * agrees with what the picker shows. It reads no vault note.
 */
export default function SettingsScreen() {
  const { styles } = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [sortMode, setSortMode] = useSetting("sortMode");
  const [taskForm, setTaskForm] = useSetting("taskForm");
  const vault = useVault();

  const version = Constants.expoConfig?.version ?? "unknown";
  const channel = buildChannel();
  const root = vault.root ?? "Not granted";

  return (
    <View
      testID="settings-screen"
      style={[styles.screen, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <Button
          variant="text"
          tone="muted"
          label="Back"
          accessibilityLabel="back"
          onPress={() => router.back()}
        />
      </View>
      <MotionScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Settings
        </Text>

        <Section label="Appearance">
          <ThemePicker />
        </Section>

        <Section label="Lists and planner">
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Sort order</Text>
            <SegmentedControl
              segments={sortOptions}
              selected={sortMode}
              onSelect={setSortMode}
              label="sort order"
              stretch
            />
            <Text style={styles.fieldHint}>
              My order keeps the order you drag rows into.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Task form</Text>
            <SegmentedControl
              segments={formOptions}
              selected={taskForm}
              onSelect={setTaskForm}
              label="task form"
              stretch
            />
            <Text style={styles.fieldHint}>
              Rows tick in place. Chips drag first.
            </Text>
          </View>
        </Section>

        <Section label="Diagnostics">
          <Pressable
            role="button"
            accessibilityLabel="Open diagnostics"
            onPress={() => router.push("/dev")}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={styles.actionLabel}>Open diagnostics</Text>
            <Icon name="chevron-right" color="inkFaint" />
          </Pressable>
        </Section>

        <Section label="About">
          <InfoRow label="Version" value={version} />
          <Divider />
          <InfoRow label="Build channel" value={channel} />
          <Divider />
          <InfoRow label="Vault folder" value={root} />
          <Divider />
          <Pressable
            role="link"
            tabIndex={0}
            accessibilityLabel="Repository"
            onPress={() => void Linking.openURL(REPO)}
            style={({ pressed }) => [
              styles.infoRow,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.infoLabel}>Repository</Text>
            <Text style={styles.link}>{REPO}</Text>
          </Pressable>
        </Section>
      </MotionScrollView>
    </View>
  );
}

/** A titled group on the page grid. The card holds the rows. */
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <SectionHeader label={label} tone="muted" />
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Divider() {
  const { styles } = useThemedStyles(makeStyles);
  return <View style={styles.divider} />;
}

/** A read-only fact: its name over its value, so a long vault uri
    wraps inside the card. */
function InfoRow({ label, value }: { label: string; value: string }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.paper,
    },
    // The back button spans the window; its row holds to the measure.
    header: {
      maxWidth: measure,
      width: "100%",
      alignSelf: "center",
      alignItems: "flex-start",
      paddingHorizontal: pageGutter - spacing.s,
      paddingVertical: spacing.s,
    },
    content: {
      maxWidth: measure,
      width: "100%",
      alignSelf: "center",
      paddingHorizontal: pageGutter,
      paddingBottom: spacing.xxl,
      gap: spacing.xl,
    },
    title: {
      ...type.title,
      color: colors.ink,
    },
    section: {
      gap: spacing.s,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      overflow: "hidden",
    },
    field: {
      gap: spacing.s,
      padding: spacing.m,
    },
    fieldLabel: {
      ...type.eyebrow,
      color: colors.inkMuted,
    },
    fieldHint: {
      ...type.caption,
      color: colors.inkMuted,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.hairline,
    },
    action: {
      minHeight: touchTarget,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.m,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    actionLabel: {
      ...type.body,
      flex: 1,
      color: colors.ink,
    },
    infoRow: {
      minHeight: touchTarget,
      justifyContent: "center",
      gap: 2,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
    },
    infoLabel: {
      ...type.eyebrow,
      color: colors.inkMuted,
    },
    infoValue: {
      ...type.meta,
      color: colors.ink,
    },
    link: {
      ...type.meta,
      color: colors.accent,
      textDecorationLine: "underline",
    },
  }),
});
