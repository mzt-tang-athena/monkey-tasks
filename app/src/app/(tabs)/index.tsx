import * as React from "react";
import { Platform, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { groupByDue, inList, type TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import { TaskRow } from "../../components/TaskRow";
import { BottomBar } from "../../components/BottomBar";
import { useTasks } from "../../store/tasks";
import { dayLabel } from "../../lib/dates";
import { colors, fonts, spacing, radius, radiusFloating, radii, measure, pageGutter } from "../../theme/tokens";

/**
 * Lists tab: the Focus list and a catch-all Main list, with capture
 * docked above the bottom bar.
 */
type ListTab = "Focus" | "Main";

const TARGETS: CaptureTarget[] = [
  { kind: "list", name: "Focus", uri: "mock://vault/Tasks/Lists/Focus.md" },
  { kind: "main" },
];

export default function ListsScreen() {
  const store = useTasks();
  const tasks = store.tasks;
  const status = store.status;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = React.useState<ListTab>("Main");
  const [menu, setMenu] = React.useState<{
    open: boolean;
    top: number;
    left: number;
  } | null>(null);
  const dotsRef = React.useRef<React.ComponentRef<typeof View>>(null);

  // Native tab swipe: the pan activates on real horizontal travel,
  // so vertical list scrolling keeps every gesture.
  const tabSwipe = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-80, 80])
        .failOffsetY([-24, 24])
        .onEnd((e) => {
          if (e.translationX <= -80) {
            setTab((current) => (current === "Focus" ? "Main" : current));
          } else if (e.translationX >= 80) {
            setTab((current) => (current === "Main" ? "Focus" : current));
          }
        }),
    [],
  );

  const storeToggle = store.toggle;
  const toggle = React.useCallback(
    (task: TaskItem) => {
      void storeToggle(task);
    },
    [storeToggle],
  );

  // A real reload: the loader can fail when it talks to the vault,
  // so the error state keeps its retry affordance (also wired to
  // FlatList's pull-to-refresh).
  const [refreshing, setRefreshing] = React.useState(false);
  const reload = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await store.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [store]);

  const visible = inTabTasks(tasks, tab);
  const groups = groupByDue(visible, new Date());

  const sections: {
    title: string;
    items: TaskItem[];
    tone: "danger" | "muted" | "ink";
  }[] = [
    { title: "Past", items: groups.overdue, tone: "danger" },
    { title: "Today", items: groups.today, tone: "ink" },
    ...groups.upcoming.map((bucket) => ({
      title: dayLabel(bucket.date, new Date()),
      items: bucket.items,
      tone: "muted" as const,
    })),
    { title: "No date", items: groups.undated, tone: "muted" },
  ];
  const shown = sections.filter((section) => section.items.length > 0);

  const openMenu = () => {
    dotsRef.current?.measureInWindow((x, y, width, height) => {
      setMenu({
        open: true,
        top: y + height + 4,
        left: Math.max(x + width - 216, spacing.m),
      });
    });
  };

  const closeMenu = () => setMenu(null);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {menu?.open ? (
        // The backdrop sits under the menu card and swallows taps
        // anywhere else, closing the menu.
        <Pressable
          style={styles.menuBackdrop}
          onPress={closeMenu}
          accessibilityLabel="close menu"
          accessibilityRole="button"
        />
      ) : null}
      {(() => {
        const body = (
        <View style={styles.body}>
        {/* The list tab bar sits ABOVE the scroller: the page's fixed
            chrome. Sections scroll beneath it, the bar never moves.
            A horizontal swipe on the body walks the tabs. */}
        {(store.mode === "mock" || store.status === "error") &&
        Platform.OS !== "web" ? (
          <Pressable
            style={({ pressed }) => [
              styles.grantRow,
              pressed && styles.grantRowPressed,
            ]}
            onPress={() => void store.grant()}
            accessibilityRole="button"
            accessibilityLabel="connect vault folder"
          >
            <Text style={styles.grantTitle}>Connect your vault folder</Text>
            <Text style={styles.grantHint}>
              Pick the Obsidian vault to use this app with real tasks.
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.tabBar}>
          {(["Focus", "Main"] as ListTab[]).map((name) => (
            <Pressable
              key={name}
              style={({ pressed }) => [
                styles.tabChip,
                pressed && styles.chipPressed,
              ]}
              onPress={() => setTab(name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === name }}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === name && styles.tabTextActive,
                ]}
              >
                {name}
              </Text>
            </Pressable>
          ))}
          <View style={styles.tabSpacer} />
          <IconButton label="sort list">
            <View style={styles.glyphSort}>
              <View style={[styles.glyphSortBar, { width: 16 }]} />
              <View style={[styles.glyphSortBar, { width: 11 }]} />
              <View style={[styles.glyphSortBar, { width: 6 }]} />
            </View>
          </IconButton>
          <View ref={dotsRef}>
            <IconButton
              label="list menu"
              active={menu?.open ?? false}
              onPress={() => (menu?.open ? closeMenu() : openMenu())}
            >
              <View style={styles.glyphDots}>
                <View style={styles.glyphDot} />
                <View style={styles.glyphDot} />
                <View style={styles.glyphDot} />
              </View>
            </IconButton>
          </View>
        </View>
        <FlatList
          contentContainerStyle={styles.content}
          onRefresh={reload}
          refreshing={refreshing}
          data={[{ key: "lists" }]}
          renderItem={() => (
            <View>
              {status === "loading" ? <LoadingState /> : null}
              {status === "error" ? (
                <EmptyState
                  label={store.lastError ?? "Something went wrong. Pull to retry."}
                />
              ) : null}
              {status === "ready" && shown.length === 0 ? (
                <EmptyState label="Nothing on this list yet." />
              ) : null}

              {status === "ready"
                ? shown.map((section) => (
                    <View key={section.title} style={styles.group}>
                      <Text
                        style={[styles.groupLabel, toneLabel(section.tone)]}
                      >
                        {section.title}
                        {"  "}
                        {section.items.length}
                      </Text>
                      {section.items.map((task, index) => (
                        <View
                          key={task.uri}
                          style={index > 0 ? styles.groupRow : undefined}
                        >
                          <TaskRow task={task} onToggle={toggle} />
                        </View>
                      ))}
                    </View>
                  ))
                : null}

              {status === "ready" && groups.completed.length > 0 ? (
                <View style={[styles.group, styles.completedGroup]}>
                  <Text style={styles.completedLabel}>
                    Completed  {groups.completed.length}
                  </Text>
                  {groups.completed.map((task, index) => (
                    <View
                      key={task.uri}
                      style={index > 0 ? styles.groupRow : undefined}
                    >
                      <TaskRow task={task} onToggle={toggle} />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        />
      </View>
        );
        const nativeSwipe = (
          <GestureDetector gesture={tabSwipe}>{body}</GestureDetector>
        );
        return Platform.OS === "web" ? body : nativeSwipe;
      })()}
      {/* The overflow menu, anchored to the dots button. */}
      {menu?.open ? (
        <View style={[styles.menu, { top: menu.top, left: menu.left }]}>
          {(
            [
              { key: "rename", label: "Rename list", danger: false },
              { key: "delete-list", label: "Delete list", danger: true },
              {
                key: "clear-done",
                label: "Delete all completed tasks",
                danger: true,
              },
              { key: "diagnostics", label: "Diagnostics", danger: false },
            ] as const
          ).map((action) => (
            <Pressable
              key={action.key}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && styles.menuItemPressed,
              ]}
              // The list actions are visual only this round: a tap
              // just closes. Diagnostics opens the dev screen.
              onPress={() => {
                closeMenu();
                if (action.key === "diagnostics") {
                  router.push("/dev");
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Text
                style={[
                  styles.menuItemText,
                  action.danger && styles.menuItemDanger,
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* One bottom bar: nav left, capture button right. The target
          pill follows the active list tab: the bar re-reads the
          default target when the tab changes, so the bar itself never
          remounts and never jumps. Focus preselects Focus; Main
          remains the default when no list tab owns it. */}
      <BottomBar
        targets={TARGETS}
        defaultTargetIndex={tab === "Focus" ? 0 : 1}
        onSend={(parsed, target) => store.capture(parsed, target)}
      />
    </View>
  );
}

/**
 * Focus shows the Focus list. Main is the catch-all: every task that is
 * not on Focus, so a task tagged with a list that has no tab yet (Work,
 * Errands) still appears instead of vanishing.
 */
function inTabTasks(tasks: TaskItem[] | null, tab: ListTab): TaskItem[] {
  const all = tasks ?? [];
  const focus = inList(all, "Focus");
  if (tab === "Focus") {
    return focus;
  }
  const onFocus = new Set(focus.map((item) => item.uri));
  return all.filter((item) => !onFocus.has(item.uri));
}

/** A quiet 36pt glyph button: hover, pressed, and active states. */
function IconButton({
  label,
  active,
  onPress,
  children,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.iconButton,
        (hover || pressed) && styles.iconButtonHot,
        active && styles.iconButtonActive,
      ]}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {children}
    </Pressable>
  );
}

const toneLabel = (() => {
  const map = StyleSheet.create({
    danger: { color: colors.danger },
    muted: { color: colors.inkMuted },
    ink: { color: colors.accent },
  });
  return (tone: "danger" | "muted" | "ink") => map[tone];
})();

function LoadingState() {
  return (
    <View style={styles.holder}>
      <View style={[styles.skeleton, { width: "40%" as const }]} />
      <View style={[styles.skeleton, { width: "70%" as const }]} />
      <View style={[styles.skeleton, { width: "55%" as const }]} />
    </View>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.holder}>
      <Text style={styles.empty}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    // The lists screen shares the planner's no-selection rule: a
    // row drag or tab swipe must not start text selection.
    userSelect: "none" as const,
  },
  body: {
    flex: 1,
  },
  content: {
    maxWidth: measure,
    alignSelf: "center" as const,
    width: "100%" as const,
    // F's centered feel: real page margins, rows never touch the edge.
    paddingHorizontal: pageGutter,
    paddingTop: spacing.m,
    paddingBottom: spacing.xl,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    maxWidth: measure,
    alignSelf: "center" as const,
    width: "100%" as const,
    // Fixed chrome above the scroller: opaque over the paper, its
    // content on the page grid, breathing room under it.
    backgroundColor: colors.paper,
    paddingHorizontal: pageGutter,
    paddingTop: spacing.l,
    paddingBottom: spacing.m,
  },
  tabChip: {
    minHeight: 36,
    paddingHorizontal: spacing.s,
    justifyContent: "center",
  },
  chipPressed: {
    backgroundColor: colors.pressed,
    borderRadius: radius,
  },
  tabText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "500",
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: "700",
    textDecorationLine: "underline",
    textDecorationColor: colors.accent,
  },
  tabSpacer: {
    flex: 1,
  },
  grantRow: {
    maxWidth: measure,
    alignSelf: "center" as const,
    width: "100%" as const,
    paddingHorizontal: pageGutter,
    paddingTop: spacing.m,
  },
  grantRowPressed: {
    opacity: 0.7,
  },
  grantTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.accent,
    fontWeight: "600",
  },
  grantHint: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    marginTop: 2,
  },

  // Quiet top-right controls: sort glyph and the three-dot overflow.
  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius,
  },
  iconButtonHot: {
    backgroundColor: colors.pressed,
  },
  iconButtonActive: {
    backgroundColor: colors.accentSoft,
  },
  glyphSort: {
    alignItems: "flex-end" as const,
    gap: 3,
  },
  glyphSortBar: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.inkMuted,
  },
  glyphDots: {
    alignItems: "center" as const,
    gap: 2.5,
  },
  glyphDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: colors.inkMuted,
  },

  // The overflow menu: a small floating card on a full-screen
  // invisible backdrop.
  menuBackdrop: {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  menu: {
    position: "absolute" as const,
    width: 216,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radiusFloating,
    paddingVertical: spacing.xs,
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  menuItem: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.m,
  },
  menuItemPressed: {
    backgroundColor: colors.pressed,
  },
  menuItemText: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  menuItemDanger: {
    color: colors.danger,
  },

  // Plain groups: a header on the paper, flush rows beneath.
  group: {
    marginTop: spacing.l,
  },
  groupLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingBottom: spacing.xs,
  },
  groupRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  completedGroup: {
    opacity: 0.55,
    marginTop: spacing.xl,
  },
  completedLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.inkFaint,
    paddingBottom: spacing.xs,
  },

  // States
  holder: {
    minHeight: 160,
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  skeleton: {
    height: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.hairline,
    marginVertical: spacing.m,
  },
  empty: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textAlign: "center",
  },
});
