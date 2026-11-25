import * as React from "react";
import { SectionList, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TaskItem } from "@/types/task";
import { BottomBar } from "@/components/bottom-bar/bottom-bar";
import type { DockSlot } from "@/components/bottom-bar/dock-slot";
import { Pager } from "@/components/motion/pager";
import { usePageFollow } from "@/components/motion/page-follow";
import { PreviewRow } from "@/components/preview-row";
import { renderMotionScroll } from "@/components/motion/scroll-view";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/list-states";
import { VaultPrompt } from "@/components/ui/vault-prompt";
import { useStableCallback } from "@/hooks/use-stable-callback";
import { useTaskEditor } from "@/hooks/use-task-editor";
import { recordBreadcrumb } from "@/lib/breadcrumbs";
import { toggleCompleted, useCompletedOpen } from "@/lib/folded-completed";
import { TODAY_LIST } from "@/lib/list-tabs";
import { useStoreMeta } from "@/stores/tasks/task-state";
import { useClearCompleted } from "@/stores/tasks/mutations/use-clear-completed";
import { useReorderSection } from "@/stores/tasks/mutations/use-reorder-section";
import { useToggleTask } from "@/stores/tasks/mutations/use-toggle-task";
import { useGrantFolder, useRefreshTasks } from "@/stores/tasks/use-vault-read";
import { measure, pageGutter, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { todayIso } from "@/utils/dates";
import { ListPagePreview } from "./components/list-page-preview";
import { ListSectionHeader } from "./components/list-section-header";
import { FailureBanner, RepairNotice } from "./components/list-notices";
import { ListsToolbar } from "./components/lists-toolbar";
import { TaskCardRow } from "./components/task-card-row";
import { useListSections } from "./hooks/use-list-sections";
import { useListTabState } from "./hooks/use-list-tabs";
import { useSortMode } from "./hooks/use-sort-mode";
import { useTickHold } from "./hooks/use-tick-hold";
import { emptyListLabel, foldCompleted, type ListsSection } from "./lib/list-sections";
import { applyTickHold } from "./lib/tick-hold";
import { ListReorder } from "./lib/list-reorder";
import { rebaseSpan, reorderItems } from "./lib/reorder";
import type { ReorderEvent } from "@/components/motion/reorder";

/**
 * Lists tab: Main first, then one tab per list note, with capture
 * docked above the bottom bar. Main holds the unfiled tasks. The screen
 * composes the hooks and the components. Its rows reorder only
 * through `ListReorder`, and the tick holds come from each row's own
 * animation (ADR 0034, ADR 0046).
 */
export default function ListsScreen({ dock }: { dock: DockSlot }) {
  const { styles } = useThemedStyles(makeStyles);
  const editor = useTaskEditor();
  const { rootUri, status, readError } = useStoreMeta();
  const toggleTask = useToggleTask();
  const clearCompleted = useClearCompleted();
  const reorderSection = useReorderSection();
  const refresh = useRefreshTasks();
  const grant = useGrantFolder();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [pagerHeight, setPagerHeight] = React.useState(0);

  const tabState = useListTabState();
  const { tab, setTab, index, bounds, onPage } = tabState;
  // The tab strip's rule and the pager share one live page position,
  // so the rule tracks a swipe on the UI thread (ADR 0046).
  const follow = usePageFollow(index);
  const { sortMode, setSortMode } = useSortMode();
  const { shown, repairs, sections, onlyCompleted, completed, draggable } =
    useListSections(tab, sortMode);

  const tickHold = useTickHold(toggleTask);
  const held = React.useMemo(
    () => applyTickHold(sections, tickHold.holds, shown),
    [sections, tickHold.holds, shown],
  );
  // The fold is a view step: the groups above keep every row, so a
  // reorder and a tick hold read the whole group.
  const completedOpen = useCompletedOpen(tab);
  const folded = React.useMemo(
    () => foldCompleted(held, completedOpen),
    [held, completedOpen],
  );
  // A folded group still shows its count, so the header reads the
  // group before the fold.
  const counts = React.useMemo(
    () => new Map(held.map((section) => [section.key, section.data.length])),
    [held],
  );

  // A tick's regroup or a step can land under a held drag, so a drop's
  // pickup slots may name other rows by now. The pickup keys are read
  // against the rows this screen writes, which no frame can stale.
  const moveTask = React.useCallback(
    ({ group, from, to, keys }: ReorderEvent<TaskItem>) => {
      const source = held.find((section) => section.key === group);
      if (source == null) {
        return;
      }
      const span =
        keys.length === 0
          ? { from, to }
          : rebaseSpan(
              from,
              to,
              keys,
              Object.fromEntries(
                source.data.map((task, index) => [task.uri, index]),
              ),
            );
      if (span === null) {
        return;
      }
      void reorderSection(reorderItems(source.data, span.from, span.to));
    },
    [held, reorderSection],
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
    recordBreadcrumb("tick", task.data?.title ?? task.name);
    tickHold.toggle(task, held);
  });
  // A row body press opens the task editor sheet over this list.
  const onOpen = useStableCallback((task: TaskItem) => {
    recordBreadcrumb("open", task.data?.title ?? task.name);
    editor.open(task.id);
  });

  const renderSectionHeader = React.useCallback(
    ({ section }: { section: ListsSection }) => {
      // My order's single group has no title, so it draws no header.
      if (section.title == null) {
        return null;
      }
      const disclosure = section.tone === "faint";
      return (
        <ListSectionHeader
          title={section.title}
          count={counts.get(section.key) ?? section.data.length}
          tone={section.tone}
          expanded={disclosure ? completedOpen : undefined}
          onToggle={disclosure ? () => toggleCompleted(tab) : undefined}
        />
      );
    },
    [completedOpen, counts, tab],
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
          canDrag={draggable && !faint}
          onToggle={onToggle}
          onOpen={onOpen}
          onTickSettled={tickHold.settle}
        />
      );
    },
    [draggable, onToggle, onOpen, tickHold.settle],
  );

  const previewHeight = pagerHeight > 0 ? pagerHeight : window.height;

  return (
    <View testID="lists-screen" style={styles.screen}>
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
          follow={follow}
          sortMode={sortMode}
          onSortMode={setSortMode}
          sortable={tab !== TODAY_LIST}
          completed={completed}
          onClearCompleted={clearCompleted}
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
              follow={follow}
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
                {/* A tab is a different list, so its page starts at the
                    top, as its preview draws it. The pager's page
                    itself stays mounted (ticket 0087). */}
                <SectionList<TaskItem, ListsSection>
                  key={tab}
                  contentContainerStyle={styles.content}
                  onRefresh={reload}
                  refreshing={refreshing}
                  sections={folded}
                  keyExtractor={keyExtractor}
                  renderItem={renderItem}
                  renderSectionHeader={renderSectionHeader}
                  renderScrollComponent={renderMotionScroll}
                  ListHeaderComponent={
                    <>
                      <RepairNotice repairs={repairs} />
                      {status === "ready" && onlyCompleted ? (
                        <EmptyState label={emptyListLabel(tab)} />
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
                      <EmptyState label={emptyListLabel(tab)} />
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
          remounts and never jumps. Main captures write no list
          property; every other tab preselects its own list. Today
          writes no list either, and dates the task today. */}
      <BottomBar
        action={dock({
          targets: tabState.targets,
          defaultTargetIndex: tabState.defaultTargetIndex,
          dueDay: tab === TODAY_LIST ? todayIso() : undefined,
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

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
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
  }),
});
