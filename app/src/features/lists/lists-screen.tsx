import * as React from "react";
import { SectionList, StyleSheet, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TaskItem } from "@/types/task";
import { BottomBar } from "@/components/bottom-bar/bottom-bar";
import type { DockSlot } from "@/components/bottom-bar/dock-slot";
import { Pager } from "@/components/motion/pager";
import { PreviewRow } from "@/components/preview-row";
import { renderMotionScroll } from "@/components/motion/scroll-view";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/list-states";
import { useStableCallback } from "@/hooks/use-stable-callback";
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
import { TaskCardRow } from "./components/task-card-row";
import { useListSections } from "./hooks/use-list-sections";
import { useListTabState } from "./hooks/use-list-tabs";
import { useSortMode } from "./hooks/use-sort-mode";
import { useTickHold } from "./hooks/use-tick-hold";
import type { ListsSection } from "./lib/list-sections";
import { applyTickHold } from "./lib/tick-hold";
import { ListReorder } from "./lib/list-reorder";
import { reorderItems } from "./lib/reorder";
import type { ReorderEvent } from "@/components/motion/reorder";

/**
 * Lists tab: Main first, then one tab per list note, with capture
 * docked above the bottom bar. Main shows every task. The screen
 * composes the hooks and the components. Its rows reorder only
 * through `ListReorder`, and the tick holds come from each row's own
 * animation (ADR 0034, ADR 0046).
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

  const tickHold = useTickHold(toggleTask);
  const held = React.useMemo(
    () => applyTickHold(sections, tickHold.holds, shown),
    [sections, tickHold.holds, shown],
  );

  const moveTask = React.useCallback(
    ({ payload, group, from, to }: ReorderEvent<TaskItem>) => {
      const source = held.find((section) => section.key === group);
      if (source == null) {
        return;
      }
      void reorderSection(reorderItems(source.data, from, to));
    },
    [held, reorderSection],
  );

  // A row's Move action takes the same road as its drop: one
  // ReorderEvent into `moveTask`.
  const moveRow = React.useCallback(
    (task: TaskItem, group: string, from: number, to: number) => {
      moveTask({ payload: task, group, from, to });
    },
    [moveTask],
  );

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
    tickHold.toggle(task, held);
  });
  // A row body press opens the task editor. The id is a SAF uri, so
  // it rides one encoded path segment.
  const onOpen = useStableCallback((task: TaskItem) => {
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
      index: at,
      section,
    }: {
      item: TaskItem;
      index: number;
      section: ListsSection;
    }) => {
      const faint = section.tone === "faint";
      return (
        <TaskCardRow
          task={item}
          section={section.key}
          index={at}
          count={section.data.length}
          completed={faint}
          canDrag={sortMode === "manual" && !faint}
          onMove={moveRow}
          onToggle={onToggle}
          onOpen={onOpen}
          onTickSettled={tickHold.settle}
        />
      );
    },
    [sortMode, moveRow, onToggle, onOpen, tickHold.settle],
  );

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
        {/* A row's pan owns the finger once its hold activates. A
            resting row leaves the pager on, so a swipe still pages. */}
        <View
          style={styles.pageHost}
          onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}
        >
          <ListReorder.Root
            onReorder={moveTask}
            renderGhost={(task) => <PreviewRow task={task} />}
          >
            <ListPager
              testID="list-pager"
              index={index}
              bounds={bounds}
              onPage={onPage}
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
              <View style={styles.page}>
                <SectionList<TaskItem, ListsSection>
                  contentContainerStyle={styles.content}
                  onRefresh={reload}
                  refreshing={refreshing}
                  sections={held}
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
                  stickySectionHeadersEnabled={false}
                  removeClippedSubviews={false}
                />
              </View>
            </ListPager>
          </ListReorder.Root>
        </View>
      </View>

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

/**
 * The list's pager. It holds its page while a row is held or dragged,
 * so the row's pan owns the finger. A resting row leaves the pager on,
 * so a sideways drag still pages. The read is context, so a pickup
 * re-renders the pager and not the screen.
 */
function ListPager(props: React.ComponentProps<typeof Pager>) {
  const dragging = ListReorder.useDragging();
  return <Pager {...props} enabled={!dragging} />;
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
