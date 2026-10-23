import * as React from "react";
import { Platform, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import { TaskRow } from "../../components/TaskRow";
import { makeSwipeController, swipeProps } from "../../lib/swipe";
import { BottomBar } from "../../components/BottomBar";
import { useStoreMeta } from "../../store/task-state";
import { useTaskActions } from "../../store/task-actions";
import {
  useTabTasks,
  useTaskSections,
  type ListTab,
  type SectionTone,
} from "../../store/selectors";
import { IconButton } from "../../components/ui";
import { colors, fonts, spacing, radius, radiusFloating, radii, measure, pageGutter } from "../../theme/tokens";

/**
 * Lists tab: the Focus list and a catch-all Main list, with capture
 * docked above the bottom bar.
 */
type ListsSection = {
  title: string;
  tone: SectionTone | "faint";
  data: TaskItem[];
};

const TARGETS: CaptureTarget[] = [
  { kind: "list", name: "Focus" },
  { kind: "main" },
];

export default function ListsScreen() {
  const { mode, status, lastError } = useStoreMeta();
  const actions = useTaskActions();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = React.useState<ListTab>("Main");
  const [menu, setMenu] = React.useState<{
    open: boolean;
    top: number;
    left: number;
  } | null>(null);
  const dotsRef = React.useRef<React.ComponentRef<typeof View>>(null);

  // The tab swipe: horizontal travel on the list body walks Focus and
  // Main. Touch events, not a gesture handler, because a handler on the
  // parent of a scrolling list never sees the moves on Android.
  const [tabSwipe] = React.useState(() =>
    makeSwipeController((dir) => {
      setTab((current) => {
        if (dir === "left") {
          return current === "Focus" ? "Main" : current;
        }
        return current === "Main" ? "Focus" : current;
      });
    }),
  );

  const toggleTask = actions.toggle;
  const toggle = React.useCallback(
    (task: TaskItem) => {
      void toggleTask(task);
    },
    [toggleTask],
  );

  // A real reload: the loader can fail when it talks to the vault,
  // so the error state keeps its retry affordance (also wired to
  // the list's pull-to-refresh).
  const [refreshing, setRefreshing] = React.useState(false);
  const refresh = actions.refresh;
  const reload = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const visible = useTabTasks(tab);
  const openSections = useTaskSections(visible);
  const completed = React.useMemo(
    () =>
      visible
        .filter((task) => task.data?.completed)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [visible],
  );

  const sections = React.useMemo<ListsSection[]>(() => {
    if (status !== "ready") {
      return [];
    }
    const next: ListsSection[] = openSections.map((section) => ({
      title: section.title,
      tone: section.tone,
      data: section.items,
    }));
    if (completed.length > 0) {
      next.push({ title: "Completed", tone: "faint", data: completed });
    }
    return next;
  }, [status, openSections, completed]);

  const renderSectionHeader = React.useCallback(
    ({ section }: { section: ListsSection }) => {
      if (section.tone === "faint") {
        return (
          <View style={[styles.group, styles.completedGroup]}>
            <Text style={styles.completedLabel}>
              {section.title}
              {"  "}
              {section.data.length}
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.group}>
          <Text style={[styles.groupLabel, toneLabel(section.tone)]}>
            {section.title}
            {"  "}
            {section.data.length}
          </Text>
        </View>
      );
    },
    [],
  );

  const renderItem = React.useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: TaskItem;
      index: number;
      section: ListsSection;
    }) => (
      <View
        style={[
          index > 0 ? styles.groupRow : undefined,
          section.tone === "faint" ? styles.completedRow : undefined,
        ]}
      >
        <TaskRow task={item} onToggle={toggle} />
      </View>
    ),
    [toggle],
  );

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
      <View style={styles.body} {...swipeProps(tabSwipe)}>
        {/* The list tab bar sits ABOVE the scroller: the page's fixed
            chrome. Sections scroll beneath it, the bar never moves.
            A horizontal swipe on the body walks the tabs. */}
        {(mode === "mock" || status === "error") &&
        Platform.OS !== "web" ? (
          <Pressable
            style={({ pressed }) => [
              styles.grantRow,
              pressed && styles.grantRowPressed,
            ]}
            onPress={() => void actions.grant()}
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
        {/* A failed tick or field write leaves the list usable, so the
            message is a quiet banner over it, not the error state. */}
        {lastError != null && status !== "error" ? (
          <View style={styles.bannerSlot}>
            <View style={styles.errorBanner}>
              <Text style={styles.errorText} numberOfLines={3}>
                {lastError}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.errorDismiss,
                  pressed && styles.errorDismissPressed,
                ]}
                onPress={actions.clearError}
                accessibilityRole="button"
                accessibilityLabel="dismiss error"
              >
                <Text style={styles.errorDismissText}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <SectionList<TaskItem, ListsSection>
          contentContainerStyle={styles.content}
          onRefresh={reload}
          refreshing={refreshing}
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ItemSeparatorComponent={GroupRowSeparator}
          ListHeaderComponent={
            status === "ready" &&
            openSections.length === 0 &&
            completed.length > 0 ? (
              <EmptyState label="Nothing on this list yet." />
            ) : undefined
          }
          ListEmptyComponent={
            status === "loading" ? (
              <LoadingState />
            ) : status === "error" ? (
              <EmptyState
                label={lastError ?? "Something went wrong. Pull to retry."}
              />
            ) : (
              <EmptyState label="Nothing on this list yet." />
            )
          }
          stickySectionHeadersEnabled={false}
          removeClippedSubviews={false}
        />
      </View>
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
        onSend={(parsed, target) => actions.capture(parsed, target)}
      />
    </View>
  );
}

const keyExtractor = (item: TaskItem) => item.id;

/** The hairline between rows in a group. */
function GroupRowSeparator() {
  return <View style={styles.groupRow} />;
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

  // A failed write that leaves the screen usable: a compact strip on
  // the page grid, dismissed by hand.
  bannerSlot: {
    maxWidth: measure,
    alignSelf: "center" as const,
    width: "100%" as const,
    paddingHorizontal: pageGutter,
    paddingTop: spacing.m,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.m,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.danger,
  },
  errorDismiss: {
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius,
  },
  errorDismissPressed: {
    backgroundColor: colors.pressed,
  },
  errorDismissText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    fontWeight: "600",
    color: colors.danger,
  },

  // Quiet top-right controls: sort glyph and the three-dot overflow.
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
  completedRow: {
    opacity: 0.55,
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
