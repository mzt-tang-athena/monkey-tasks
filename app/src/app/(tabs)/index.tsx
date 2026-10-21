import * as React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { groupByDue, type TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import { TaskRow } from "../../components/TaskRow";
import { BottomBar } from "../../components/BottomBar";
import {
  inMockFocus,
  inMockMain,
  loadMockTasks,
  toggleMockCompleted,
} from "../../lib/mock";
import { dayLabel } from "../../lib/dates";
import { colors, fonts, spacing, radius, radiusFloating, radii, measure } from "../../theme/tokens";

/**
 * Variant D Lists tab, mock-driven for the design exploration.
 * The list tab bar sits at the very top, the brain breathes between
 * plain group headers, and capture is the inline composer docked
 * above the bottom bar.
 */
type ListTab = "Focus" | "Main";

const TARGETS: CaptureTarget[] = [
  { kind: "list", name: "Focus", uri: "mock://vault/Tasks/Lists/Focus.md" },
  { kind: "main" },
];

export default function ListsScreen() {
  const [tasks, setTasks] = React.useState<TaskItem[] | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [tab, setTab] = React.useState<ListTab>("Main");
  const [menu, setMenu] = React.useState<{
    open: boolean;
    top: number;
    left: number;
  } | null>(null);
  const dotsRef = React.useRef<React.ComponentRef<typeof View>>(null);

  // Mock load. Status changes only in async callbacks, so the effect
  // does not set state synchronously. Loading starts as the initial
  // state, and the error state stays a real code path.
  React.useEffect(() => {
    let cancelled = false;
    loadMockTasks()
      .then((loaded) => {
        if (!cancelled) {
          setTasks(loaded);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (task: TaskItem) => {
    setTasks((current) =>
      (current ?? []).map((item) =>
        item.uri === task.uri ? toggleMockCompleted(item) : item,
      ),
    );
  };

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
    <View style={styles.screen}>
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
      <View style={styles.body}>
        <FlatList
          contentContainerStyle={styles.content}
          data={[{ key: "lists" }]}
          renderItem={() => (
            <View>
              {/* Clean top: the list tab bar, then the quiet
                  sort and overflow controls on the right. */}
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

              {status === "loading" ? <LoadingState /> : null}
              {status === "error" ? (
                <EmptyState label="Something went wrong. Pull to retry." />
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
            ] as const
          ).map((action) => (
            <Pressable
              key={action.key}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && styles.menuItemPressed,
              ]}
              // Visual only for this round: a tap just closes.
              onPress={closeMenu}
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

      {/* One bottom bar: nav left, capture button right. */}
      <BottomBar
        targets={TARGETS}
        defaultTargetIndex={tab === "Focus" ? 0 : 1}
        onSend={() => undefined}
      />
    </View>
  );
}

function inTabTasks(tasks: TaskItem[] | null, tab: ListTab): TaskItem[] {
  const all = tasks ?? [];
  return tab === "Focus" ? inMockFocus(all) : inMockMain(all);
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
  },
  body: {
    flex: 1,
  },
  content: {
    maxWidth: measure,
    alignSelf: "center" as const,
    width: "100%" as const,
    // F's centered feel: real page margins, rows never touch the edge.
    paddingHorizontal: 26,
    paddingTop: spacing.l,
    paddingBottom: spacing.xl,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    marginBottom: spacing.l,
    // Optical alignment: the header shares the task rows' content
    // edges, inset by the row's own padding.
    paddingHorizontal: spacing.m,
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
  count: {
    marginLeft: "auto" as const,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkFaint,
  },
  tabSpacer: {
    flex: 1,
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
