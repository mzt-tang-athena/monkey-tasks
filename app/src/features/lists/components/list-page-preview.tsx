import * as React from "react";
import { StyleSheet, View } from "react-native";
import { PreviewRow } from "@/components/preview-row";
import { CardGroupRow, cardPosition } from "@/components/ui/card-group-row";
import type { SortMode } from "@/lib/settings";
import { measure, pageGutter, spacing } from "@/theme/tokens";
import { useListSections } from "../hooks/use-list-sections";
import { ListSectionHeader } from "./list-section-header";
import { RepairNotice } from "./list-notices";

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
}: {
  tab: string;
  sortMode: SortMode;
}) {
  const { sections, repairs } = useListSections(tab, sortMode);

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.content}>
        <RepairNotice repairs={repairs} />
        {sections.map((section) => (
          <View key={section.key}>
            <ListSectionHeader
              title={section.title}
              count={section.data.length}
              tone={section.tone}
            />
            {section.data.map((task, index) => (
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
