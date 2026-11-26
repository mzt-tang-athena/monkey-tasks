import * as React from "react";
import { AppState, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import AlarmAccess from "alarm-access";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { SegmentedControl, type Segment } from "@/components/ui/segmented-control";
import { SectionHeader } from "@/components/ui/section-header";
import { Switch } from "@/components/ui/switch";
import { ScrollEdge } from "@/components/motion/scroll-edge";
import { MotionScrollView } from "@/components/motion/scroll-view";
import { useVault } from "@/lib/vault/vault-provider";
import { askExactAlarms, exactAlarmState } from "@/lib/notifications";
import { useSetting } from "@/lib/settings-store";
import { appVersion, buildChannel } from "@/lib/build-info";
import type { SortMode, TaskForm, WeekLayout, WeekStart } from "@/lib/settings";
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
import { CrashLogCard } from "./components/crash-log-card";

const REPO = "https://github.com/mzt-tang-athena/monkey-tasks";

function openNotificationPolicy(): void {
  AlarmAccess.openDndAccess();
}

const sortOptions: Segment<SortMode>[] = [
  { key: "manual", label: "My order" },
  { key: "due", label: "Due date" },
];

const formOptions: Segment<TaskForm>[] = [
  { key: "rows", label: "Rows" },
  { key: "pills", label: "Chips" },
];

const weekOptions: Segment<WeekLayout>[] = [
  { key: "spread", label: "Spread" },
  { key: "rows", label: "Rows" },
];

const weekStartOptions: Segment<WeekStart>[] = [
  { key: "monday", label: "Monday" },
  { key: "sunday", label: "Sunday" },
];

/**
 * The settings screen. It owns the palette picker, the settings the
 * Lists and Planner screens share, and the optional built-in lists.
 * Every value reads and writes `lib/settings.ts`; the theme goes
 * through its provider, and the screen settings go through the live
 * store so a mounted screen agrees with what the picker shows. It
 * reads no vault note.
 */
export default function SettingsScreen() {
  const { styles } = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [sortMode, setSortMode] = useSetting("sortMode");
  const [taskForm, setTaskForm] = useSetting("taskForm");
  const [weekView, setWeekView] = useSetting("weekView");
  const [weekStart, setWeekStart] = useSetting("weekStart");
  const [todayList, setTodayList] = useSetting("todayList");
  const [boardList, setBoardList] = useSetting("boardList");
  const vault = useVault();
  // Read when this screen shows again, which is when the operator comes
  // back from granting the access.
  const [dndAccess, setDndAccess] = React.useState(() =>
    AlarmAccess.hasDndAccess(),
  );
  const [exactAlarms, setExactAlarms] = React.useState(true);
  React.useEffect(() => {
    void exactAlarmState().then(setExactAlarms, () => undefined);
  }, []);
  const readAccess = React.useCallback(() => {
    setDndAccess(AlarmAccess.hasDndAccess());
    void exactAlarmState().then(setExactAlarms, () => undefined);
  }, []);
  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        readAccess();
      }
    });
    return () => subscription.remove();
  }, [readAccess]);

  const version = appVersion();
  const channel = buildChannel();
  const root = vault.root ?? "Not granted";

  // One row per optional built-in list. Off is the default, so a fresh
  // install sees Main and the list notes alone until a switch turns on.
  const builtinRows = [
    {
      key: "today",
      label: "Today list",
      hint: "Due today, with past tasks above them.",
      on: todayList === "on",
      change: (next: boolean) => setTodayList(next ? "on" : "off"),
    },
    {
      key: "board",
      label: "Board",
      hint: "Deeds by status, after Main.",
      on: boardList === "on",
      change: (next: boolean) => setBoardList(next ? "on" : "off"),
    },
  ];

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
      <View style={styles.body}>
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
            <View style={styles.divider} />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Week view</Text>
              <SegmentedControl
                segments={weekOptions}
                selected={weekView}
                onSelect={setWeekView}
                label="week view"
                stretch
              />
              <Text style={styles.fieldHint}>
                Spread pairs two days per row. Rows stack all seven.
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Week starts on</Text>
              <SegmentedControl
                segments={weekStartOptions}
                selected={weekStart}
                onSelect={setWeekStart}
                label="week starts on"
                stretch
              />
              <Text style={styles.fieldHint}>
                The week grid, the month grid and the week strip follow it.
              </Text>
            </View>
          </Section>

          <Section label="Built-in lists">
            {builtinRows.map((row, at) => (
              <React.Fragment key={row.key}>
                {at > 0 ? <Divider /> : null}
                <View style={styles.action}>
                  <View style={styles.rowText}>
                    <Text style={styles.actionLabel}>{row.label}</Text>
                    <Text style={styles.fieldHint}>{row.hint}</Text>
                  </View>
                  <Switch
                    checked={row.on}
                    label={row.label}
                    onCheckedChange={row.change}
                    testID={`builtin-switch:${row.key}`}
                  />
                </View>
              </React.Fragment>
            ))}
          </Section>

          {Platform.OS === "android" ? (
            <Section label="Alerts">
              <Pressable
                role="button"
                accessibilityLabel="Alerts past Do Not Disturb"
                onPress={() => void openNotificationPolicy()}
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.actionLabel}>Alerts past Do Not Disturb</Text>
                <Icon name="chevron-right" color="inkFaint" />
              </Pressable>
              <View style={styles.field}>
                <Text style={styles.fieldHint}>
                  {dndAccess
                    ? "Granted. An alarm sounds past Do Not Disturb."
                    : "An alarm stays below Do Not Disturb until you grant this."}
                </Text>
              </View>
              <Divider />
              <Pressable
                role="button"
                accessibilityLabel="Alarms and reminders"
                onPress={() => void askExactAlarms()}
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.actionLabel}>Alarms and reminders</Text>
                <Icon name="chevron-right" color="inkFaint" />
              </Pressable>
              <View style={styles.field}>
                <Text style={styles.fieldHint}>
                  {exactAlarms
                    ? "Granted. An alarm rings at its minute."
                    : "Until you grant this, the phone may ring an alarm late."}
                </Text>
              </View>
            </Section>
          ) : null}

          <Section label="Diagnostics">
            <CrashLogCard />
            <Divider />
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
        <ScrollEdge testID="settings-edge" />
      </View>
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
    body: {
      flex: 1,
    },
    content: {
      maxWidth: measure,
      width: "100%",
      alignSelf: "center",
      paddingHorizontal: pageGutter,
      paddingTop: spacing.m,
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
    rowText: {
      flex: 1,
      gap: 2,
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
