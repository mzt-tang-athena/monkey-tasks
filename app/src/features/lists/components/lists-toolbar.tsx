import * as React from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { TabStrip } from "@/components/ui/tab-strip";
import { useCommandPane } from "@/hooks/use-command-pane";
import type { SortMode } from "@/lib/settings";
import { measure, pageGutter, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import type { TaskItem } from "@/types/task";
import { ClearCompletedSheet } from "./clear-completed-sheet";

const sortOptions: { key: SortMode; label: string; hint: string }[] = [
  { key: "due", label: "Due date", hint: "Soonest first" },
  { key: "manual", label: "My order", hint: "Drag rows to sort" },
];

/**
 * The Lists screen's top chrome: the list tabs, the sort button and
 * the overflow button, with the two menus they open. The surface band
 * and its hairline span the window. Only the content inside caps at
 * the reading measure, so the chrome reads as one band on a wide
 * screen.
 */
export function ListsToolbar({
  tabs,
  tab,
  onSelectTab,
  sortMode,
  onSortMode,
  completed,
  onClearCompleted,
}: {
  tabs: string[];
  tab: string;
  onSelectTab: (tab: string) => void;
  sortMode: SortMode;
  onSortMode: (mode: SortMode) => void;
  /** The current tab's completed rows: what a clear deletes. */
  completed: readonly TaskItem[];
  onClearCompleted: (tasks: readonly TaskItem[]) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const { show } = useCommandPane();
  // One menu at a time: opening one closes the other.
  const [open, setOpen] = React.useState<"sort" | "more" | null>(null);
  // The clear's confirmation. It keeps the snapshot and the sheet's
  // lifetime apart, so the count holds while the sheet leaves.
  const [clear, setClear] = React.useState<{
    tasks: readonly TaskItem[];
    open: boolean;
  } | null>(null);
  const sortAnchor = React.useRef<React.ComponentRef<typeof View>>(null);
  const moreAnchor = React.useRef<React.ComponentRef<typeof View>>(null);
  const close = React.useCallback(() => setOpen(null), []);

  const sortItems: MenuItem[] = sortOptions.map((option) => ({
    key: option.key,
    label: option.label,
    hint: option.hint,
    selected: sortMode === option.key,
    onPress: () => {
      onSortMode(option.key);
      close();
    },
  }));
  // Rename list and Delete list come with ticket 0065. Until then the
  // menu holds only what works. A tab with no completed task gets no
  // clear item, so a danger action never reads as available.
  const moreItems: MenuItem[] = [
    {
      key: "settings",
      label: "Settings",
      onPress: () => {
        close();
        router.push("/settings");
      },
    },
    {
      key: "diagnostics",
      label: "Diagnostics",
      onPress: () => {
        close();
        router.push("/dev");
      },
    },
  ];
  if (completed.length > 0) {
    moreItems.push({
      key: "clear-completed",
      label: "Delete all completed tasks",
      tone: "danger",
      onPress: () => {
        close();
        setClear({ tasks: [...completed], open: true });
      },
    });
  }

  const shut = () =>
    setClear((current) => (current == null ? current : { ...current, open: false }));

  return (
    <View style={styles.band}>
      <View style={styles.content}>
        <TabStrip
          tabs={tabs}
          selected={tab}
          onSelect={onSelectTab}
          label="Lists"
        />
        <View style={styles.spacer} />
        <IconButton label="open commands" onPress={show}>
          <Icon name="chevron-down" />
        </IconButton>
        <View ref={sortAnchor} testID="sort-menu-anchor">
          <IconButton
            label="sort list"
            active={open === "sort" || sortMode !== "due"}
            expanded={open === "sort"}
            onPress={() => setOpen(open === "sort" ? null : "sort")}
          >
            <SortGlyph />
          </IconButton>
        </View>
        <View ref={moreAnchor} testID="list-menu-anchor">
          <IconButton
            label="list menu"
            active={open === "more"}
            expanded={open === "more"}
            onPress={() => setOpen(open === "more" ? null : "more")}
          >
            <DotsGlyph />
          </IconButton>
        </View>
      </View>
      <Menu
        open={open === "sort"}
        anchor={sortAnchor}
        onClose={close}
        label="Sort list"
        kind="radiogroup"
        items={sortItems}
      />
      <Menu
        open={open === "more"}
        anchor={moreAnchor}
        onClose={close}
        label="List menu"
        items={moreItems}
      />
      {clear != null ? (
        <ClearCompletedSheet
          open={clear.open}
          tasks={clear.tasks}
          onCancel={shut}
          onConfirm={(tasks) => {
            shut();
            onClearCompleted(tasks);
          }}
          onExited={() => setClear(null)}
        />
      ) : null}
    </View>
  );
}

/** Three bars that shorten: the sort glyph. */
function SortGlyph() {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.sort}>
      {[16, 11, 6].map((width) => (
        <View key={width} style={[styles.sortBar, { width }]} />
      ))}
    </View>
  );
}

/** Three dots: the overflow glyph. */
function DotsGlyph() {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.dot} />
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    // Fixed chrome above the scroller: a surface step above the paper,
    // closed by a hairline that runs edge to edge.
    band: {
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.hairline,
    },
    content: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      maxWidth: measure,
      alignSelf: "center",
      width: "100%",
      paddingHorizontal: pageGutter,
      paddingTop: spacing.s,
    },
    spacer: {
      flex: 1,
    },
    sort: {
      alignItems: "flex-end",
      gap: 3,
    },
    sortBar: {
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.inkMuted,
    },
    dots: {
      alignItems: "center",
      gap: 2.5,
    },
    dot: {
      width: 3.5,
      height: 3.5,
      borderRadius: 1.75,
      backgroundColor: colors.inkMuted,
    },
  }),
});
