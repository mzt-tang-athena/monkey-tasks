import * as React from "react";
import { SectionList, StyleSheet, View } from "react-native";
import type { TaskItem } from "@/types/task";
import { renderMotionScroll } from "@/components/motion/scroll-view";
import { TaskRow } from "@/components/task-row";
import { ErrorState, LoadingState } from "@/components/ui/list-states";
import { recordBreadcrumb } from "@/lib/breadcrumbs";
import { useBoardFoldOpen, toggleBoardGroup } from "@/lib/folded-board";
import type { SortMode } from "@/lib/settings";
import { useStoreMeta, useTaskList } from "@/stores/tasks/task-state";
import { usePatchTask } from "@/stores/tasks/mutations/use-patch-task";
import { useReorderSection } from "@/stores/tasks/mutations/use-reorder-section";
import { useToggleTask } from "@/stores/tasks/mutations/use-toggle-task";
import { useRefreshTasks } from "@/stores/tasks/use-vault-read";
import { measure, pageGutter, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { nowStamp } from "@/utils/dates";
import { ListSectionHeader } from "./list-section-header";
import { BoardCardRow } from "./board-card-row";
import { useTickHold } from "../hooks/use-tick-hold";
import { BoardReorder, type BoardCard } from "../lib/board-reorder";
import {
  blockerOf,
  deedStatus,
  foldBoard,
  notesByName,
  selectBoardSections,
  selectDeeds,
  statusWrite,
  type BoardSection,
  type BoardStatus,
} from "../lib/board";
import { applyTickHold } from "../lib/tick-hold";
import { rebaseSpan, reorderItems } from "../lib/reorder";
import type { ReorderEvent } from "@/components/motion/reorder";

/**
 * The Board: a tab on the Lists pager that groups the vault's deeds by
 * status. Design A stacks Active, Backlog and Someday down the page,
 * with Done and Dropped folded at the end. A grip drag reorders inside
 * a group, and a drop on another group's header moves the deed there in
 * one note write. A due-date sort turns the drag off (ADR
 * 20261125-deed-board-is-the-kanban-list).
 */
export function BoardPage({
  sortMode,
  onOpen,
}: {
  sortMode: SortMode;
  onOpen: (task: TaskItem) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const { status, readError } = useStoreMeta();
  const tasks = useTaskList();
  const patchTask = usePatchTask();
  const toggleTask = useToggleTask();
  const reorderSection = useReorderSection();
  const refresh = useRefreshTasks();
  const openGroups = useBoardFoldOpen();

  const deeds = React.useMemo(() => selectDeeds(tasks), [tasks]);
  const byName = React.useMemo(() => notesByName(tasks), [tasks]);
  const sections = React.useMemo(
    () => selectBoardSections(deeds, sortMode),
    [deeds, sortMode],
  );
  const blockers = React.useMemo(() => {
    const found = new Map<string, string | null>();
    for (const deed of deeds) {
      found.set(deed.uri, blockerOf(deed, byName));
    }
    return found;
  }, [deeds, byName]);

  const tickHold = useTickHold(toggleTask);
  const held = React.useMemo(
    () => applyTickHold(sections, tickHold.holds, deeds),
    [sections, tickHold.holds, deeds],
  );
  // A folded group still shows its count, so the header reads the group
  // before the fold.
  const counts = React.useMemo(
    () => new Map(held.map((section) => [section.key, section.data.length])),
    [held],
  );
  const folded = React.useMemo(
    () =>
      foldBoard(held, (group) => openGroups.has(group)),
    [held, openGroups],
  );

  const [refreshing, setRefreshing] = React.useState(false);
  const reload = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const onToggle = React.useCallback(
    (task: TaskItem) => {
      recordBreadcrumb("tick", task.data?.title ?? task.name);
      tickHold.toggle(task, held);
    },
    [held, tickHold],
  );
  const open = React.useCallback(
    (task: TaskItem) => {
      recordBreadcrumb("open", task.data?.title ?? task.name);
      onOpen(task);
    },
    [onOpen],
  );

  // A drop on a header moves the deed's status, and lands it first in
  // the group. A drop between rows writes `order` alone. A drop on the
  // group it came from changes nothing.
  const move = React.useCallback(
    ({ payload, group, from, to, keys, zone }: ReorderEvent<BoardCard>) => {
      const source = held.find((section) => section.key === group);
      if (source == null) {
        return;
      }
      const deed = payload.task;
      if (zone != null) {
        const target = zone as BoardStatus;
        if (deedStatus(deed) === target) {
          return;
        }
        if (target === "done") {
          // Done goes through the one completion path, so a repeat makes
          // its next note and the alarms move with it.
          void toggleTask(deed);
          return;
        }
        const first = held.find((section) => section.key === target);
        const order =
          first == null || first.data.length === 0
            ? 1
            : Math.min(...first.data.map((row) => row.data?.order ?? 1)) - 1;
        void patchTask(deed, {
          ...statusWrite(deed, target, nowStamp()),
          order,
        });
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
    [held, patchTask, reorderSection, toggleTask],
  );

  const renderSectionHeader = React.useCallback(
    ({ section }: { section: BoardSection }) => {
      const openNow = openGroups.has(section.status);
      return (
        <BoardReorder.Zone
          target={section.status}
          label={`Move to ${section.title}`}
          testID={`board-header:${section.status}`}
        >
          <ListSectionHeader
            title={section.title}
            count={counts.get(section.key) ?? section.data.length}
            tone={section.tone}
            expanded={section.foldable ? openNow : undefined}
            onToggle={
              section.foldable
                ? () => toggleBoardGroup(section.status)
                : undefined
            }
          />
        </BoardReorder.Zone>
      );
    },
    [counts, openGroups],
  );

  const renderItem = React.useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: TaskItem;
      index: number;
      section: BoardSection;
    }) => (
      <BoardCardRow
        task={item}
        section={section}
        index={index}
        count={section.data.length}
        canDrag={sortMode === "manual"}
        blockedBy={blockers.get(item.uri) ?? null}
        onToggle={onToggle}
        onOpen={open}
        onTickSettled={tickHold.settle}
      />
    ),
    [blockers, open, onToggle, sortMode, tickHold.settle],
  );

  if (status === "loading") {
    return <LoadingState />;
  }
  if (status === "error") {
    return (
      <ErrorState
        message={readError ?? "Something went wrong."}
        onRetry={() => void reload()}
      />
    );
  }

  return (
    <View style={styles.page}>
      <BoardReorder.Root
        onReorder={move}
        renderGhost={(card) => <TaskRow copy task={card.task} />}
      >
        <SectionList<TaskItem, BoardSection>
          contentContainerStyle={styles.content}
          onRefresh={reload}
          refreshing={refreshing}
          sections={folded}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          renderScrollComponent={renderMotionScroll}
          stickySectionHeadersEnabled={false}
          removeClippedSubviews={false}
        />
      </BoardReorder.Root>
    </View>
  );
}

const keyExtractor = (item: TaskItem) => item.id;

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.paper,
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
