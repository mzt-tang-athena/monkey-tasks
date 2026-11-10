import * as React from "react";
import {
  Platform,
  SectionList,
  StyleSheet,
  View,
  useWindowDimensions,
  type PointerEvent as RNPointerEvent,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TaskItem } from "@/types/task";
import { BottomBar } from "@/components/bottom-bar/bottom-bar";
import type { DockSlot } from "@/components/bottom-bar/dock-slot";
import { Pager } from "@/components/motion/pager";
import { renderMotionScroll } from "@/components/motion/scroll-view";
import { cardPosition } from "@/components/ui/card-group-row";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/list-states";
import { useStableCallback } from "@/hooks/use-stable-callback";
import { usePressGuard } from "@/hooks/use-press-guard";
import { useStoreMeta } from "@/stores/tasks/task-state";
import { useReorderSection } from "@/stores/tasks/mutations/use-reorder-section";
import { useToggleTask } from "@/stores/tasks/mutations/use-toggle-task";
import { useGrantFolder, useRefreshTasks } from "@/stores/tasks/use-vault-read";
import { colors, measure, pageGutter, spacing } from "@/theme/tokens";
import { ListPagePreview } from "./components/list-page-preview";
import { ListSectionHeader } from "./components/list-section-header";
import {
  FailureBanner,
  RepairNotice,
  VaultPrompt,
} from "./components/list-notices";
import { ListsToolbar } from "./components/lists-toolbar";
import { ReorderGhost } from "./components/reorder-ghost";
import { TaskCardRow } from "./components/task-card-row";
import { useListSections } from "./hooks/use-list-sections";
import { useListTabState } from "./hooks/use-list-tabs";
import { useRowReorder } from "./hooks/use-row-reorder";
import { useSortMode } from "./hooks/use-sort-mode";
import { useTickHold } from "./hooks/use-tick-hold";
import type { ListsSection } from "./lib/list-sections";
import { applyTickHold } from "./lib/tick-hold";

const noop = () => undefined;

/**
 * Lists tab: Main first, then one tab per list note, with capture
 * docked above the bottom bar. Main shows every task. The screen
 * composes the hooks and the components. It holds no state of its own
 * beyond the pull to refresh.
 */
export default function ListsScreen({ dock }: { dock: DockSlot }) {
  const { rootUri, status, readError } = useStoreMeta();
  const toggleTask = useToggleTask();
  const reorderSection = useReorderSection();
  const refresh = useRefreshTasks();
  const grant = useGrantFolder();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [pagerHeight, setPagerHeight] = React.useState(0);

  const tabState = useListTabState();
  const { tab, setTab, index, bounds, onPage } = tabState;
  const { sortMode, setSortMode } = useSortMode();
  const { shown, repairs, sections, onlyCompleted } = useListSections(
    tab,
    sortMode,
  );

  // A press that ends a drop must not also press the row. The swipe no
  // longer arms it: the pager's pan cancels the press itself.
  const guard = usePressGuard();

  const tickHold = useTickHold(toggleTask);
  const held = React.useMemo(
    () => applyTickHold(sections, tickHold.hold, shown),
    [sections, tickHold.hold, shown],
  );
  const {
    lifted,
    ghostY,
    previewIndex,
    displaySections,
    registerRow,
    shiftOf,
    holdRow,
    pickupRow,
    moveRow,
    endRow,
  } = useRowReorder({
    sections: held,
    write: reorderSection,
    // The reorder no longer has a swipe to claim. It keeps its web
    // pointer handlers until 0060 moves it onto the reorder surface.
    claimSwipe: noop,
    onDrop: () => {
      guard.arm();
      guard.release();
    },
  });

  // A real reload: the loader can fail when it talks to the vault, so
  // the error state keeps its retry affordance (also wired to the
  // list's pull to refresh).
  const [refreshing, setRefreshing] = React.useState(false);
  const reload = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  // The row callbacks have one identity for the screen's life, so a
  // tick re-renders the ticked row and no other.
  const onToggle = useStableCallback((task: TaskItem) => {
    if (guard.blocked()) {
      return;
    }
    tickHold.toggle(task, displaySections);
  });
  // A row body press opens the task editor. The id is a SAF uri, so
  // it rides one encoded path segment.
  const onOpen = useStableCallback((task: TaskItem) => {
    if (guard.blocked()) {
      return;
    }
    router.push(`/task/${encodeURIComponent(task.id)}`);
  });

  const renderSectionHeader = React.useCallback(
    ({ section }: { section: ListsSection }) => (
      <ListSectionHeader
        title={section.title}
        count={section.data.length}
        tone={section.tone}
      />
    ),
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
      const faint = section.tone === "faint";
      // While a drag is live the row's slot decides its corners and its
      // divider. The list order itself does not change.
      const slot = previewIndex?.get(item.uri) ?? index;
      return (
        <TaskCardRow
          task={item}
          section={section.key}
          position={cardPosition(slot, section.data.length)}
          completed={faint}
          canDrag={sortMode === "manual" && !faint}
          lifted={lifted?.task.uri === item.uri}
          onToggle={onToggle}
          onOpen={onOpen}
          onHold={holdRow}
          onPickup={pickupRow}
          onMove={moveRow}
          onEnd={endRow}
          registerRow={registerRow}
          shiftOf={shiftOf}
        />
      );
    },
    [
      previewIndex,
      sortMode,
      lifted,
      onToggle,
      onOpen,
      holdRow,
      pickupRow,
      moveRow,
      endRow,
      registerRow,
      shiftOf,
    ],
  );

  // The reorder's web moves and ups live on the page, not on the pager
  // host. They keep working until 0060 owns the reorder.
  const reorderHandlers =
    Platform.OS === "web"
      ? {
          onPointerMove: (e: RNPointerEvent) =>
            moveRow(e.nativeEvent.pageX, e.nativeEvent.pageY),
          onPointerUp: endRow,
          onPointerCancel: endRow,
        }
      : {};

  const previewHeight = pagerHeight > 0 ? pagerHeight : window.height;

  return (
    <View style={styles.screen}>
      {/* The status bar strip takes the header's surface, so the top
          chrome reads as one band instead of a paper gap. */}
      <View style={[styles.statusStrip, { height: insets.top }]} />
      <View style={styles.body}>
        {(rootUri == null && status === "ready") || status === "error" ? (
          <VaultPrompt onGrant={() => void grant()} />
        ) : null}
        {/* The tab bar sits above the scroller: the page's fixed
            chrome. Sections scroll beneath it, the bar never moves. */}
        <ListsToolbar
          tabs={tabState.tabs}
          tab={tab}
          onSelectTab={setTab}
          sortMode={sortMode}
          onSortMode={setSortMode}
        />
        {/* A failed tick or field write leaves the list usable, so each
            one is a quiet banner over it, not the error state. */}
        {status !== "error" ? <FailureBanner /> : null}
        {/* The pager is the body under the fixed chrome. A swipe on it
            walks the tabs, and a landing writes the tab. */}
        <View
          style={styles.pageHost}
          onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}
        >
          <Pager
            testID="list-pager"
            index={index}
            bounds={bounds}
            onPage={onPage}
            // The legacy reorder owns the pointer while a row is lifted.
            enabled={lifted == null}
            renderPreview={(page) => {
              const name = tabState.tabs[page];
              return name == null ? null : (
                <ListPagePreview
                  tab={name}
                  sortMode={sortMode}
                  height={previewHeight}
                />
              );
            }}
            fill
          >
            <View style={styles.page} {...reorderHandlers}>
              <SectionList<TaskItem, ListsSection>
                contentContainerStyle={styles.content}
                onRefresh={reload}
                refreshing={refreshing}
                sections={displaySections}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                renderScrollComponent={renderMotionScroll}
                ListHeaderComponent={
                  <>
                    <RepairNotice repairs={repairs} />
                    {status === "ready" && onlyCompleted ? (
                      <EmptyState label="Nothing on this list yet." />
                    ) : null}
                  </>
                }
                ListEmptyComponent={
                  status === "loading" ? (
                    <LoadingState />
                  ) : status === "error" ? (
                    <ErrorState
                      message={readError ?? "Something went wrong."}
                      onRetry={() => void reload()}
                    />
                  ) : (
                    <EmptyState label="Nothing on this list yet." />
                  )
                }
                scrollEnabled={lifted == null}
                stickySectionHeadersEnabled={false}
                removeClippedSubviews={false}
              />
            </View>
          </Pager>
        </View>
      </View>
      <ReorderGhost lifted={lifted} y={ghostY} />

      {/* One bottom bar: nav left, capture button right. The target
          pill follows the active list tab: the bar re-reads the
          default target when the tab changes, so the bar itself never
          remounts and never jumps. Main captures write no lists
          property; every other tab preselects its own list. */}
      <BottomBar
        action={dock({
          targets: tabState.targets,
          defaultTargetIndex: tabState.defaultTargetIndex,
        })}
      />
    </View>
  );
}

const keyExtractor = (item: TaskItem) => item.id;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    // The lists screen shares the planner's no-selection rule: a
    // row drag or tab swipe must not start text selection.
    userSelect: "none",
  },
  statusStrip: {
    backgroundColor: colors.surface,
  },
  // The body holds the pager under the fixed chrome.
  body: {
    flex: 1,
  },
  // The pager's slot: the page below the toolbar and the banners.
  pageHost: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  content: {
    maxWidth: measure,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: pageGutter,
    paddingTop: spacing.m,
    paddingBottom: spacing.xl,
  },
});
