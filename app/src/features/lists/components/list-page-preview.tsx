import * as React from "react";
import { StyleSheet, View } from "react-native";
import { PreviewRow } from "@/components/preview-row";
import { CardGroupRow, cardPosition } from "@/components/ui/card-group-row";
import { EmptyState } from "@/components/ui/list-states";
import { taskFaceHeight } from "@/components/task-row-face";
import { useCompletedOpen } from "@/lib/folded-completed";
import type { SortMode } from "@/lib/settings";
import { measure, pageGutter, spacing, touchTarget } from "@/theme/tokens";
import { useListSections } from "../hooks/use-list-sections";
import { emptyListLabel, type ListsSection } from "../lib/list-sections";
import { ListSectionHeader } from "./list-section-header";
import { RepairNotice } from "./list-notices";

/**
 * The rows a preview draws on a page of `height` px: whole sections
 * from the top, and inside the last one only the rows that fit. It
 * evaluates heights from the face's own numbers, so a long list never
 * mounts more than a screenful (J1). A folded Completed group draws its
 * header and no rows, as the live page does.
 *
 * Exported for its fold test: the preview takes input from no one, so
 * the rows it would draw are the whole of its behaviour.
 */
export function previewSections(
  sections: ListsSection[],
  height: number,
  repairs: number,
  completedOpen: boolean,
): { section: ListsSection; data: ListsSection["data"] }[] {
  // The page's top padding, and a rough banner height when one shows.
  let left = Math.max(0, height - spacing.m - (repairs > 0 ? 72 : 0));
  const out: { section: ListsSection; data: ListsSection["data"] }[] = [];
  for (const section of sections) {
    const faint = section.tone === "faint";
    const folded = faint && !completedOpen;
    // A disclosure header is the 44pt row; a plain one is its label. A
    // headerless group owes no header space, so its rows start at the
    // page's own top padding.
    const header =
      section.title == null
        ? 0
        : spacing.xl +
          (faint ? touchTarget : 16) +
          (faint ? spacing.xs : spacing.s);
    if (left < header) {
      break;
    }
    left -= header;
    const data: ListsSection["data"] = [];
    if (!folded) {
      for (const task of section.data) {
        const lines = task.name.length > 34 ? 2 : 1;
        const row = taskFaceHeight(task, lines);
        if (row > left) {
          break;
        }
        left -= row;
        data.push(task);
      }
    }
    out.push({ section, data });
    if (folded || data.length < section.data.length) {
      break;
    }
  }
  return out;
}

/**
 * The peek at another list tab while a swipe carries the finger
 * toward it: the groups and cards the lists screen draws, rendered
 * still. It is a picture of the page's first screenful, so nothing
 * here takes input and nothing scrolls. It draws the same
 * `SectionHeader`, `CardGroupRow` and `TaskRowFace` as the live list,
 * through the shared group header and the still row. A headerless
 * group, as My order draws, gets no header here either.
 */
export function ListPagePreview({
  tab,
  sortMode,
  height,
}: {
  tab: string;
  sortMode: SortMode;
  /** The pager's height, in px. Only the rows that fit it draw. */
  height: number;
}) {
  const { sections, repairs, onlyCompleted } = useListSections(tab, sortMode);
  const completedOpen = useCompletedOpen(tab);
  const visible = previewSections(
    sections,
    height,
    repairs.length,
    completedOpen,
  );

  return (
    <View testID="list-preview" style={styles.root} pointerEvents="none">
      <View style={styles.content}>
        <RepairNotice repairs={repairs} />
        {onlyCompleted ? <EmptyState label={emptyListLabel(tab)} /> : null}
        {sections.length === 0 ? (
          <EmptyState label={emptyListLabel(tab)} />
        ) : null}
        {visible.map(({ section, data }) => (
          <View key={section.key}>
            {section.title == null ? null : (
              <ListSectionHeader
                title={section.title}
                count={section.data.length}
                tone={section.tone}
                expanded={section.tone === "faint" ? completedOpen : undefined}
              />
            )}
            {data.map((task, index) => (
              <CardGroupRow
                key={task.uri}
                position={cardPosition(index, section.data.length)}
              >
                <View style={styles.main}>
                  <PreviewRow task={task} done={task.data?.completed != null} />
                </View>
              </CardGroupRow>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  // The same page grid the scroller uses, so the peek lines up with
  // the page it becomes.
  content: {
    maxWidth: measure,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: pageGutter,
    paddingTop: spacing.m,
  },
  main: {
    flex: 1,
  },
});
