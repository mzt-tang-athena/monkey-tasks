import * as React from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import { TaskRow } from "../../components/TaskRow";
import { ReorderGrip, ReorderRow } from "../../features/lists/ReorderRow";
import {
  layoutOrder,
  moveItem,
  reorderItems,
} from "../../features/lists/reorder";
import { makeSwipeController, swipeProps } from "../../lib/swipe";
import { loadSettings, saveSetting, type SortMode } from "../../lib/settings";
import { BottomBar } from "../../components/BottomBar";
import { useStoreMeta, useTaskList } from "../../store/task-state";
import { useTaskActions } from "../../store/task-actions";
import {
  useListTabs,
  useTabTasks,
  useTaskSections,
  type ListTab,
  type SectionTone,
} from "../../store/selectors";
import { IconButton } from "../../components/ui";
import { colors, drag, fonts, spacing, radius, radiusFloating, radii, measure, pageGutter } from "../../theme/tokens";

/**
 * Lists tab: Main first, then one tab per list note, with capture
 * docked above the bottom bar. Main shows every task.
 */
type ListsSection = {
  title: string;
  tone: SectionTone | "faint";
  data: TaskItem[];
};

export default function ListsScreen() {
  const { mode, status, lastError, brokenLists } = useStoreMeta();
  const allTasks = useTaskList();
  const actions = useTaskActions();
  const insets = useSafeAreaInsets();
  const tabs = useListTabs();
  const [tab, setTab] = React.useState<ListTab>("Main");
  const [sortMode, setSortMode] = React.useState<SortMode>(
    () => loadSettings().sortMode,
  );
  const [menu, setMenu] = React.useState<{
    open: boolean;
    top: number;
    left: number;
  } | null>(null);
  const [sortMenu, setSortMenu] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const dotsRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const sortRef = React.useRef<React.ComponentRef<typeof View>>(null);
  // The tab strip scrolls the active chip into view after a swipe or a
  // tap. Chip offsets are measured once and kept for the session.
  const stripRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const chipX = React.useRef<Record<string, number>>({});

  // The capture targets follow the tab order: Main, then one list
  // target per list note. Main stores nothing; a list target writes
  // its name into the captured task's lists property.
  const targets = React.useMemo<CaptureTarget[]>(
    () =>
      tabs.map((name) =>
        name === "Main"
          ? { kind: "main" as const }
          : { kind: "list" as const, name },
      ),
    [tabs],
  );

  // The names can grow after a read. The swipe controller is created
  // once, so it walks the current names through a ref instead of the
  // pair it saw on the first render.
  const tabsRef = React.useRef(tabs);
  React.useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  // The tab swipe: horizontal travel on the list body walks the tab
  // bar's order. Touch events, not a gesture handler, because a
  // handler on the parent of a scrolling list never sees the moves on
  // Android.
  const [tabSwipe] = React.useState(() =>
    makeSwipeController((dir) => {
      setTab((current) => {
        const names = tabsRef.current;
        const index = names.indexOf(current);
        if (index === -1) {
          return current;
        }
        const next = dir === "left" ? index + 1 : index - 1;
        return names[next] ?? current;
      });
    }),
  );

  // A tab that is off screen would hide the current view's name, so
  // the strip follows the selection. The user can still scroll it.
  React.useEffect(() => {
    const x = chipX.current[tab];
    if (x == null) {
      return;
    }
    stripRef.current?.scrollTo({ x: Math.max(0, x - spacing.m), animated: true });
  }, [tab]);

  // The pill preselects the active tab's target; Main is the fallback
  // when the tab has no target of its own.
  const defaultTargetIndex = React.useMemo(() => {
    const index = targets.findIndex((target) =>
      tab === "Main"
        ? target.kind === "main"
        : target.kind === "list" && target.name === tab,
    );
    return index === -1 ? 1 : index;
  }, [targets, tab]);

  const toggleTask = actions.toggle;
  const toggle = React.useCallback(
    (task: TaskItem) => {
      void toggleTask(task);
    },
    [toggleTask],
  );

  // A row body press opens the task editor. The id is a SAF uri, so
  // it rides one encoded path segment.
  const openTask = React.useCallback((task: TaskItem) => {
    router.push(`/task/${encodeURIComponent(task.id)}`);
  }, []);

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

  // A note that fails validation never renders as a task row. It is
  // shown, with its errors, in the repair block above the list.
  const brokenTasks = React.useMemo(
    () =>
      allTasks
        .filter((task) => (task.errors?.length ?? 0) > 0)
        .map((task) => ({
          name: task.name,
          uri: task.uri,
          errors: task.errors ?? [],
        })),
    [allTasks],
  );
  const repairs = React.useMemo(
    () => [...brokenLists, ...brokenTasks],
    [brokenLists, brokenTasks],
  );
  const shown = useTabTasks(tab);
  const visible = React.useMemo(
    () => shown.filter((task) => (task.errors?.length ?? 0) === 0),
    [shown],
  );
  const openSections = useTaskSections(visible, sortMode);
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

  // The manual reorder: a hold (or the grip) lifts a row, the rows
  // reflow live under it, and the drop writes `order` for the rows
  // whose position changed. The floating row moves through an
  // Animated value, so a pointer move costs no render.
  const [reorder, setReorder] = React.useState<{
    task: TaskItem;
    section: string;
    from: number;
    to: number;
    /** The row's left edge and width, in root coordinates. */
    left: number;
    width: number;
  } | null>(null);
  const [ghostY] = React.useState(() => new Animated.Value(0));
  // One translateY per row: the slide from the old place to the new.
  const [rowShift] = React.useState(
    () => new Map<string, Animated.Value>(),
  );
  // The sequence the last drop wrote, held on screen until every note
  // is saved: the rows must not snap back while the writes land.
  const [settling, setSettling] = React.useState<{
    section: string;
    data: TaskItem[];
  } | null>(null);
  const rootY = React.useRef(0);
  const grabOffset = React.useRef(0);
  const rootRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const rowRefs = React.useRef(
    new Map<
      string,
      {
        measureInWindow?: (
          cb: (x: number, y: number, w: number, h: number) => void,
        ) => void;
      } | null
    >(),
  );
  const reorderRects = React.useRef<{ uri: string; y: number; h: number }[]>(
    [],
  );
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReorder = React.useRef<{
    task: TaskItem;
    section: string;
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const suppressClick = React.useRef(false);

  const clearHold = React.useCallback(() => {
    if (holdTimer.current != null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const armReorder = React.useCallback(() => {
    const pending = pendingReorder.current;
    if (pending == null) {
      return;
    }
    pendingReorder.current = null;
    clearHold();
    setSettling(null);
    // The reorder owns the gesture now, not the tab swipe.
    tabSwipe.claim();
    const items =
      sections.find((s) => s.title === pending.section)?.data ?? [];
    reorderRects.current = [];
    const measure = (rootX: number, rootY: number) => {
      for (const item of items) {
        rowRefs.current.get(item.uri)?.measureInWindow?.((x, y, w, h) => {
          reorderRects.current.push({ uri: item.uri, y, h });
          if (item.uri === pending.task.uri) {
            grabOffset.current = pending.y - y;
            ghostY.setValue(y - rootY);
            setReorder({
              task: pending.task,
              section: pending.section,
              from: pending.index,
              to: pending.index,
              left: x - rootX,
              width: w,
            });
          }
        });
      }
    };
    const root = rootRef.current as unknown as {
      measureInWindow?: (
        cb: (x: number, y: number, w: number, h: number) => void,
      ) => void;
    } | null;
    if (root?.measureInWindow) {
      root.measureInWindow((x, y) => measure(x, y));
    } else {
      measure(0, 0);
    }
  }, [clearHold, ghostY, sections, tabSwipe]);

  const holdRow = React.useCallback(
    (
      task: TaskItem,
      index: number,
      section: string,
      e: { pageX: number; pageY: number },
    ) => {
      pendingReorder.current = {
        task,
        section,
        index,
        x: e.pageX,
        y: e.pageY,
      };
      clearHold();
      holdTimer.current = setTimeout(armReorder, drag.pickMs);
    },
    [armReorder, clearHold],
  );

  const armReorderNow = React.useCallback(
    (task: TaskItem, index: number, section: string, x: number, y: number) => {
      pendingReorder.current = { task, section, index, x, y };
      armReorder();
    },
    [armReorder],
  );

  const moveReorder = React.useCallback(
    (x: number, y: number) => {
      if (reorder == null) {
        const pending = pendingReorder.current;
        if (
          pending != null &&
          Math.abs(x - pending.x) + Math.abs(y - pending.y) > drag.threshold
        ) {
          pendingReorder.current = null;
          clearHold();
        }
        return;
      }
      // A live drag owns the gesture: the tab swipe must not arm.
      tabSwipe.claim();
      ghostY.setValue(y - rootY.current - grabOffset.current);
      const rects = [...reorderRects.current].sort((a, b) => a.y - b.y);
      if (rects.length === 0) {
        return;
      }
      let to = rects.length;
      for (let i = 0; i < rects.length; i += 1) {
        if (y < rects[i].y + rects[i].h / 2) {
          to = i;
          break;
        }
      }
      if (to !== reorder.to) {
        // Each row starts where it was and slides to its new place,
        // instead of blinking there.
        const items =
          sections.find((s) => s.title === reorder.section)?.data ?? [];
        const rects = reorderRects.current;
        const before = layoutOrder(
          moveItem(items, reorder.from, reorder.to),
          rects,
          StyleSheet.hairlineWidth,
        );
        const after = layoutOrder(
          moveItem(items, reorder.from, to),
          rects,
          StyleSheet.hairlineWidth,
        );
        for (const [uri, y] of before) {
          const delta = y - (after.get(uri) ?? y);
          if (delta === 0) {
            continue;
          }
          let value = rowShift.get(uri);
          if (value == null) {
            value = new Animated.Value(0);
            rowShift.set(uri, value);
          }
          value.setValue(delta);
          Animated.timing(value, {
            toValue: 0,
            duration: 160,
            useNativeDriver: Platform.OS !== "web",
          }).start();
        }
        setReorder({ ...reorder, to });
      }
    },
    [clearHold, ghostY, reorder, rowShift, sections, tabSwipe],
  );

  const endReorder = React.useCallback(() => {
    clearHold();
    pendingReorder.current = null;
    const current = reorder;
    if (current == null) {
      return;
    }
    setReorder(null);
    // The drop's click must not also open the row.
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 350);
    const items =
      sections.find((s) => s.title === current.section)?.data ?? [];
    const next = moveItem(items, current.from, current.to);
    if (next !== items) {
      setSettling({ section: current.section, data: next });
    }
    const changes = reorderItems(items, current.from, current.to);
    void (async () => {
      try {
        for (const change of changes) {
          await actions.writeFields(change.task, { order: change.order });
        }
      } finally {
        setSettling(null);
      }
    })();
  }, [actions, clearHold, reorder, sections]);

  // The rows as they render while a drag is live: the section under
  // the pointer shows the sequence the drop would write.
  const displaySections = React.useMemo(() => {
    if (reorder != null) {
      return sections.map((section) =>
        section.title === reorder.section
          ? {
              ...section,
              data: moveItem(section.data, reorder.from, reorder.to),
            }
          : section,
      );
    }
    if (settling != null) {
      return sections.map((section) =>
        section.title === settling.section
          ? { ...section, data: settling.data }
          : section,
      );
    }
    return sections;
  }, [sections, reorder, settling]);

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
    }) => {
      const canDrag = sortMode === "manual" && section.tone !== "faint";
      const lifted = reorder?.task.uri === item.uri;
      return (
        <View
          ref={(node) => {
            if (node != null) {
              rowRefs.current.set(item.uri, node as never);
            }
          }}
          style={[
            styles.cardRow,
            index === 0 && styles.cardFirst,
            index === section.data.length - 1 && styles.cardLast,
            section.tone === "faint" ? styles.completedRow : undefined,
            lifted && styles.rowSlot,
            rowShift.has(item.uri)
              ? { transform: [{ translateY: rowShift.get(item.uri)! }] }
              : undefined,
          ]}
        >
          <ReorderRow
            enabled={canDrag}
            onHold={(e) =>
              holdRow(item, index, section.title, {
                pageX: e.nativeEvent.pageX,
                pageY: e.nativeEvent.pageY,
              })
            }
            onPickup={(x, y) =>
              armReorderNow(item, index, section.title, x, y)
            }
            onMove={moveReorder}
            onEnd={endReorder}
          >
            <View style={[styles.rowMain, lifted && styles.rowHidden]}>
              <TaskRow
                task={item}
                onToggle={(task) => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  toggle(task);
                }}
                onOpen={(task) => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  openTask(task);
                }}
              />
            </View>
          </ReorderRow>
          {canDrag ? (
            <ReorderGrip
              hidden={lifted}
              onPickup={(x, y) =>
                armReorderNow(item, index, section.title, x, y)
              }
              onMove={moveReorder}
              onEnd={endReorder}
            />
          ) : null}
        </View>
      );
    },
    [
      toggle,
      openTask,
      sortMode,
      reorder,
      rowShift,
      holdRow,
      armReorderNow,
      moveReorder,
      endReorder,
    ],
  );

  const openSortMenu = () => {
    // One menu at a time: opening this one closes the other.
    setMenu(null);
    sortRef.current?.measureInWindow((x, y, width, height) => {
      setSortMenu({
        top: y + height + 4,
        left: Math.max(x + width - 216, spacing.m),
      });
    });
  };

  const openMenu = () => {
    setSortMenu(null);
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
    <View
      ref={(node) => {
        rootRef.current = node;
      }}
      style={styles.screen}
    >
      {/* The status bar strip takes the header's surface, so the top
          chrome reads as one band instead of a paper gap. */}
      <View style={[styles.statusStrip, { height: insets.top }]} />
      {menu?.open || sortMenu != null ? (
        // The backdrop sits under the menu card and swallows taps
        // anywhere else, closing the menu.
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => {
            closeMenu();
            setSortMenu(null);
          }}
          accessibilityLabel="close menu"
          accessibilityRole="button"
        />
      ) : null}
      <View
        style={styles.body}
        // The handlers read refs when the gesture runs, not in render.
        // eslint-disable-next-line react-hooks/refs
        {...swipeProps(tabSwipe, { move: moveReorder, up: endReorder })}
      >
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
          {/* A vault can hold more lists than the bar fits, so the
              chips scroll and the sort and menu buttons stay put. */}
          <ScrollView
            ref={stripRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabStrip}
            contentContainerStyle={styles.tabStripContent}
          >
            {tabs.map((name) => (
              <Pressable
                key={name}
                style={({ pressed }) => [
                  styles.tabChip,
                  pressed && styles.chipPressed,
                ]}
                onPress={() => setTab(name)}
                onLayout={(event) => {
                  chipX.current[name] = event.nativeEvent.layout.x;
                }}
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
                <View
                  style={[
                    styles.tabRule,
                    tab === name && styles.tabRuleActive,
                  ]}
                />
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.tabSpacer} />
          <View ref={sortRef}>
            <IconButton
              label="sort list"
              active={sortMenu != null || sortMode !== "due"}
              onPress={() =>
                sortMenu == null ? openSortMenu() : setSortMenu(null)
              }
            >
              <View style={styles.glyphSort}>
                <View style={[styles.glyphSortBar, { width: 16 }]} />
                <View style={[styles.glyphSortBar, { width: 11 }]} />
                <View style={[styles.glyphSortBar, { width: 6 }]} />
              </View>
            </IconButton>
          </View>
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
        {/* A list note that fails validation stays visible here, with
            its errors, so it can be fixed in Obsidian. It never hides
            the tabs or the tasks. */}
        {repairs.length > 0 ? (
          <View style={styles.repairSlot}>
            <View style={styles.repairBox}>
              <Text style={styles.repairTitle}>Needs repair</Text>
              {repairs.map((item) => (
                <View key={item.uri} style={styles.repairItem}>
                  <Text style={styles.repairName}>{item.name}.md</Text>
                  {item.errors.map((error, index) => (
                    <Text key={index} style={styles.repairError}>
                      {`\u2022 ${error}`}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </View>
        ) : null}
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
          sections={displaySections}
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
          scrollEnabled={reorder == null}
          stickySectionHeadersEnabled={false}
          removeClippedSubviews={false}
        />
      </View>
      {/* The dragged row rides the pointer while the list reflows
          under it. Its slot stays empty, so the gap is the drop. */}
      {reorder != null ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dragRow,
            reorder.width > 0
              ? { left: reorder.left, width: reorder.width }
              : { left: pageGutter, right: pageGutter },
            { top: ghostY },
          ]}
        >
          <TaskRow task={reorder.task} />
        </Animated.View>
      ) : null}

      {/* The sort sheet: two orders, the active one checked. My order
          is what the row drag writes. */}
      {sortMenu != null ? (
        <View style={[styles.menu, { top: sortMenu.top, left: sortMenu.left }]}>
          {(
            [
              { key: "due", label: "Due date", hint: "Soonest first" },
              { key: "manual", label: "My order", hint: "Drag rows to sort" },
            ] as const
          ).map((option) => (
            <Pressable
              key={option.key}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && styles.menuItemPressed,
              ]}
              onPress={() => {
                setSortMode(option.key);
                saveSetting("sortMode", option.key);
                setSortMenu(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: sortMode === option.key }}
              accessibilityLabel={option.label}
            >
              <Text
                style={[
                  styles.menuItemText,
                  sortMode === option.key && styles.menuItemActive,
                ]}
              >
                {option.label}
              </Text>
              <Text style={styles.menuItemHint}>{option.hint}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

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
          remounts and never jumps. Main captures write no lists
          property; every other tab preselects its own list. */}
      <BottomBar
        targets={targets}
        defaultTargetIndex={defaultTargetIndex}
        onSend={(parsed, target) => actions.capture(parsed, target)}
      />
    </View>
  );
}

const keyExtractor = (item: TaskItem) => item.id;

/**
 * The hairline between two rows of one card. It starts at the text,
 * so the card's edge stays clean.
 */
function GroupRowSeparator() {
  return <View style={styles.cardDivider} />;
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
  statusStrip: {
    backgroundColor: colors.surface,
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
    // Fixed chrome above the scroller: a surface step above the paper,
    // closed by a hairline, so the list body reads as a separate sheet.
    backgroundColor: colors.surface,
    paddingHorizontal: pageGutter,
    paddingTop: spacing.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  tabStrip: {
    flexShrink: 1,
  },
  tabStripContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingRight: spacing.m,
  },
  tabChip: {
    minHeight: 44,
    paddingHorizontal: spacing.m,
    justifyContent: "center",
  },
  chipPressed: {
    backgroundColor: colors.pressed,
    borderRadius: radius,
  },
  tabText: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "500",
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: "700",
  },
  tabRule: {
    position: "absolute" as const,
    left: spacing.m,
    right: spacing.m,
    bottom: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  tabRuleActive: {
    backgroundColor: colors.accent,
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

  // Notes that fail validation: a block on the page grid, above the
  // list, naming the file and each error so it can be fixed in the
  // vault.
  repairSlot: {
    maxWidth: measure,
    alignSelf: "center" as const,
    width: "100%" as const,
    paddingHorizontal: pageGutter,
    paddingTop: spacing.m,
  },
  repairBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    gap: spacing.s,
  },
  repairTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.danger,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  },
  repairItem: {
    gap: 2,
  },
  repairName: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.ink,
    fontWeight: "600",
  },
  repairError: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.danger,
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
  menuItemActive: {
    color: colors.accent,
    fontWeight: "600",
  },
  // The grip sits beside the row, so the row keeps its own width.
  rowMain: {
    flex: 1,
  },
  // The row that follows the pointer during a reorder.
  dragRow: {
    position: "absolute" as const,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  // The reorder: the dragged row dims and the gap it will take draws
  // as a line, without moving any row.
  rowHidden: {
    opacity: 0,
  },
  // The slot the lifted row leaves: tinted, so it reads as a place
  // to land rather than an empty task.
  rowSlot: {
    backgroundColor: colors.accentSoft,
  },

  menuItemHint: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    marginTop: 1,
  },

  // Plain groups: a header on the paper, flush rows beneath.
  group: {
    marginTop: spacing.xl,
  },
  groupLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingBottom: spacing.s,
  },
  // One card per group, built from its rows: the sides on every row,
  // the top and its radii on the first, the bottom on the last.
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  cardFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
  },
  cardLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius,
    borderBottomRightRadius: radius,
  },
  // Inset to the text: the row's own padding, the circle, its gap.
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginLeft: spacing.l + 24 + spacing.m,
  },
  completedGroup: {
    opacity: 0.55,
    marginTop: spacing.xl,
  },
  completedRow: {
    opacity: 0.55,
  },
  completedLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1,
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
