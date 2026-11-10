import * as React from "react";
import { StyleSheet, View } from "react-native";
import { PreviewRow } from "@/components/preview-row";
import { CardGroupRow, cardPosition } from "@/components/ui/card-group-row";
import { EmptyState } from "@/components/ui/list-states";
import { taskFaceHeight } from "@/components/task-row-face";
import type { SortMode } from "@/lib/settings";
import { measure, pageGutter, spacing } from "@/theme/tokens";
import { useListSections } from "../hooks/use-list-sections";
import type { ListsSection } from "../lib/list-sections";
import { ListSectionHeader } from "./list-section-header";
import { RepairNotice } from "./list-notices";

/**
 * The rows a preview draws on a page of `height` px: whole sections
 * from the top, and inside the last one only the rows that fit. It
 * evaluates heights from the face's own numbers, so a long list never
 * mounts more than a screenful (J1).
 */
function previewSections(
  sections: ListsSection[],
  height: number,
  repairs: number,
): { section: ListsSection; data: ListsSection["data"] }[] {
  // The page's top padding, and a rough banner height when one shows.
  let left = Math.max(0, height - spacing.m - (repairs > 0 ? 72 : 0));
  const out: { section: ListsSection; data: ListsSection["data"] }[] = [];
  for (const section of sections) {
    const header =
      spacing.xl +
      16 +
      (section.tone === "faint" ? spacing.xs : spacing.s);
    if (left < header) {
      break;
    }
    left -= header;
    const data: ListsSection["data"] = [];
    for (const task of section.data) {
      const lines = task.name.length > 34 ? 2 : 1;
      const row = taskFaceHeight(task, lines);
      if (row > left) {
        break;
      }
      left -= row;
      data.push(task);
    }
    if (data.length === 0) {
      break;
    }
    out.push({ section, data });
    if (data.length < section.data.length) {
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
 * through the shared group header and the still row.
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
  const visible = previewSections(sections, height, repairs.length);

  return (
    <View testID="list-preview" style={styles.root} pointerEvents="none">
      <View style={styles.content}>
        <RepairNotice repairs={repairs} />
        {onlyCompleted ? <EmptyState label="Nothing on this list yet." /> : null}
        {sections.length === 0 ? (
          <EmptyState label="Nothing on this list yet." />
        ) : null}
        {visible.map(({ section, data }) => (
          <View key={section.key}>
            <ListSectionHeader
              title={section.title}
              count={section.data.length}
              tone={section.tone}
            />
            {data.map((task, index) => (
              <CardGroupRow
                key={task.uri}
                position={cardPosition(index, section.data.length)}
                style={section.tone === "faint" ? styles.completed : undefined}
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
  completed: {
    opacity: 0.55,
  },
});
