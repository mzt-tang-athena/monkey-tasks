import * as React from "react";
import {
  FlatList,
  Text,
  View,
  type PointerEvent as RNPointerEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { TaskItem } from "../../tasks/query";
import type { TaskForm } from "../../../lib/settings";
import { TaskRow } from "../../../components/TaskRow";
import type { Mode, Source } from "../model";
import { FormToggle } from "./FormToggle";
import { Pickup, type DragApi, type LiftState } from "./drag";
import { SourceToggle } from "./SourceToggle";
import { TaskPills } from "./TaskPills";
import { styles } from "./plannerStyles";

/** Pills mode has no rows, so the list renders header and footer only. */
const noTasks: TaskItem[] = [];

/**
 * The shared bottom-half task section: the source control on the
 * left, the small form toggle on the right, then the section's
 * tasks as rows or pills, the same data both ways. Day and Month
 * render this; Week renders it with its placement pool. An optional
 * header block carries a group header (overdue, tapped day) and an
 * optional footer carries the month's open-in-day-view link. Rows
 * ride a FlatList so long sources stay windowed; the section head,
 * header, pills and footer are its header and footer slots. A caller
 * may pass a style to size the list, e.g. inside a pane.
 */
export function TaskListSection({
  source,
  mode,
  sourceMenuOpen,
  onCycleSource,
  onOpenSourceMenu,
  taskForm,
  onFormChange,
  onToggle,
  onOpen,
  onDragStart,
  tasks,
  emptyLabel,
  header,
  footer,
  lifted,
  api,
  style,
}: {
  source: Source;
  mode: Mode;
  sourceMenuOpen: boolean;
  onCycleSource: () => void;
  onOpenSourceMenu: (anchor: { top: number; left: number }) => void;
  taskForm: TaskForm;
  onFormChange: (form: TaskForm) => void;
  onToggle: (task: TaskItem) => void;
  /** A row body press opens the task; absent leaves the body inert. */
  onOpen?: (task: TaskItem) => void;
  onDragStart: (task: TaskItem, e: RNPointerEvent) => void;
  tasks: TaskItem[];
  emptyLabel: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  lifted?: LiftState;
  api?: DragApi;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <FlatList
      style={style}
      data={taskForm === "rows" ? tasks : noTasks}
      keyExtractor={(task) => task.id}
      renderItem={({ item }) => (
        <Pickup
          task={item}
          api={api}
          lifted={lifted ?? null}
          onPointerDown={(e) => onDragStart(item, e)}
        >
          <TaskRow task={item} onToggle={onToggle} onOpen={onOpen} />
        </Pickup>
      )}
      ItemSeparatorComponent={RowSeparator}
      ListHeaderComponent={
        <>
          <View style={styles.sectionHead}>
            <SourceToggle
              source={source}
              mode={mode}
              menuOpen={sourceMenuOpen}
              onCycle={onCycleSource}
              onOpenMenu={onOpenSourceMenu}
            />
            <View style={styles.sectionSpacer} />
            <FormToggle form={taskForm} onChange={onFormChange} />
          </View>
          {header}
          {/* Pills stay a wrapped grid inside the header, not list
              items: each pill sizes itself to its label and the grid
              reflows per row, which a vertical list cannot do. */}
          {taskForm === "pills" ? (
            <TaskPills
              tasks={tasks}
              onDragStart={onDragStart}
              lifted={lifted ?? null}
              api={api}
            />
          ) : null}
        </>
      }
      ListEmptyComponent={
        tasks.length === 0 ? <Text style={styles.empty}>{emptyLabel}</Text> : undefined
      }
      ListFooterComponent={
        footer == null ? undefined : <View>{footer}</View>
      }
      initialNumToRender={12}
      windowSize={7}
      maxToRenderPerBatch={12}
      removeClippedSubviews={false}
    />
  );
}

/** The hairline between rows: the same group rule the rows used to
    carry as a top border, now owned by the list's separator slot. */
function RowSeparator() {
  return <View style={styles.groupRow} />;
}
