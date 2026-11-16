import * as React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardState } from "react-native-keyboard-controller";
import { MotionScrollView } from "@/components/motion/scroll-view";
import { Banner } from "@/components/ui/banner";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import type { Progress } from "@/lib/motion/progress";
import type { TaskEdit } from "@/types/task";
import {
  radii,
  spacing,
  touchTarget,
  type,
  type Palette,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { bodyOf, noteText, PROPERTIES, type Property } from "../model";
import { AlertsPicker } from "./alerts-picker";
import { DuePicker } from "./due-picker";
import { ListPicker } from "./list-picker";
import { NoteEditor } from "./note-editor";
import { PickerSheet } from "./picker-sheet";
import { RepeatPicker } from "./repeat-picker";

/** The sheet's open pickers: one at a time, over the editor. */
export type Picker = "due" | "repeat" | "list" | "alerts" | null;

/**
 * The task editor's sheet: the list, the menu, the title, then the
 * tiles of the properties that have a value and the strip of chips for
 * the ones that do not. A tile opens its picker, or the note editor.
 * Every change is already written when the sheet closes.
 */
export function EditorSheet({
  open,
  progress,
  draft,
  today,
  lists,
  write,
  onChange,
  onRetry,
  onClose,
  onDelete,
  onToggle,
}: {
  open: boolean;
  progress: Progress;
  draft: TaskEdit;
  today: Date;
  lists: string[];
  write: { kind: "idle" } | { kind: "writing" } | { kind: "failed"; message: string };
  onChange: (patch: Partial<TaskEdit>) => void;
  onRetry: () => void;
  onClose: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const keyboard = useKeyboardState((state) => state.height);
  const [picker, setPicker] = React.useState<Picker>(null);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [title, setTitle] = React.useState(draft.name);
  const [menu, setMenu] = React.useState(false);
  const menuAnchor = React.useRef<React.ComponentRef<typeof View>>(null);

  // A draft name that changed elsewhere, such as a retried write, reads
  // back into the field.
  const [shownName, setShownName] = React.useState(draft.name);
  if (shownName !== draft.name) {
    setShownName(draft.name);
    setTitle(draft.name);
  }

  // A title writes on blur, on submit and on close, never per keystroke:
  // a rename writes a new file under SAF. An empty title never writes.
  const commitTitle = () => {
    const name = title.trim();
    if (name === "") {
      setTitle(draft.name);
      return;
    }
    if (name !== draft.name) {
      onChange({ name });
    }
  };

  const openPicker = (property: Property) => {
    commitTitle();
    if (property.key === "note") {
      setNoteOpen(true);
      return;
    }
    setPicker(property.key);
  };

  const close = () => {
    commitTitle();
    onClose();
  };

  const showing = PROPERTIES.filter((property) => property.isSet(draft));
  const missing = PROPERTIES.filter(
    (property) => property.many || !property.isSet(draft),
  );

  return (
    <>
      <Sheet
        open={open}
        onDismiss={close}
        progress={progress}
        rideKeyboard
        scrim
        covered={picker != null || noteOpen}
        label="Task"
        closeLabel="close the task"
      >
        {write.kind === "failed" ? (
          <Banner
            tone="danger"
            title="Not saved."
            lines={[write.message]}
            actions={[
              {
                label: "Retry",
                accessibilityLabel: "retry save",
                onPress: onRetry,
              },
            ]}
          />
        ) : null}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.listButton, pressed && styles.pressed]}
            onPress={() => {
              commitTitle();
              setPicker("list");
            }}
            accessibilityRole="button"
            accessibilityLabel="change list"
          >
            <Icon name="list" color="inkMuted" />
            <Text style={styles.listName} numberOfLines={1}>
              {draft.list ?? "Main"}
            </Text>
            <Icon name="chevron-down" />
          </Pressable>
          <View ref={menuAnchor} collapsable={false} testID="task-menu-anchor">
            <IconButton
              label="task menu"
              expanded={menu}
              onPress={() => setMenu(true)}
            >
              <Icon name="more" />
            </IconButton>
          </View>
        </View>
        <View style={styles.titleRow}>
          <Pressable
            style={styles.tick}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel="mark done"
          >
            <View
              style={[
                styles.tickRing,
                draft.name === "" && styles.tickRingEmpty,
              ]}
            />
          </Pressable>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={commitTitle}
            onSubmitEditing={commitTitle}
            multiline
            placeholder="Task name"
            placeholderTextColor={colors.inkFaint}
            selectionColor={colors.accent}
            aria-label="Task name"
            style={styles.title}
          />
        </View>
        {/* The tiles and the strip scroll inside the room above the
            keyboard, so the title never leaves the screen. */}
        <MotionScrollView
          style={{
            maxHeight: Math.max(120, window.height * 0.55 - keyboard - insets.top),
          }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {showing.length > 0 ? (
            <View style={styles.tiles}>
              {showing.map((property) => (
                <PropertyTile
                  key={property.key}
                  property={property}
                  draft={draft}
                  today={today}
                  onPress={() => openPicker(property)}
                  onClear={() => {
                    const patch = property.clear(draft);
                    if (patch != null) {
                      onChange(patch);
                    }
                  }}
                />
              ))}
            </View>
          ) : null}
          {missing.length > 0 ? (
            <MotionScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
            >
              {missing.map((property) => (
                <Pressable
                  key={property.key}
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                  onPress={() => openPicker(property)}
                  accessibilityRole="button"
                  accessibilityLabel={property.names.add}
                >
                  <Icon name={property.icon} color="inkMuted" />
                  <Text style={styles.chipText}>{property.chip}</Text>
                </Pressable>
              ))}
            </MotionScrollView>
          ) : null}
        </MotionScrollView>
      </Sheet>

      <Menu
        open={menu}
        anchor={menuAnchor}
        onClose={() => setMenu(false)}
        label="Task menu"
        inSheet
        items={[
          {
            key: "delete",
            label: "Delete",
            tone: "danger",
            onPress: () => {
              setMenu(false);
              onDelete();
            },
          },
        ]}
      />

      <PickerSheet
        open={picker === "due"}
        onClose={() => setPicker(null)}
        title="Due"
        doneLabel="Done"
        onDone={() => setPicker(null)}
      >
        <DuePicker
          due={draft.due}
          today={today}
          onChange={(due) => onChange({ due })}
          onClear={() => {
            onChange({ due: null });
            setPicker(null);
          }}
          onDone={() => setPicker(null)}
        />
      </PickerSheet>

      <PickerSheet
        open={picker === "repeat"}
        onClose={() => setPicker(null)}
        title="Repeat"
      >
        <RepeatPicker
          recurrence={draft.recurrence}
          due={draft.due}
          today={today}
          onPick={(recurrence, due) =>
            onChange({
              recurrence: recurrence === "" ? null : recurrence,
              ...(due != null && draft.due == null ? { due } : null),
            })
          }
          onClose={() => setPicker(null)}
        />
      </PickerSheet>

      <PickerSheet
        open={picker === "list"}
        onClose={() => setPicker(null)}
        title="List"
      >
        <ListPicker
          lists={lists}
          current={draft.list}
          onPick={(list) => onChange({ list })}
          onClose={() => setPicker(null)}
        />
      </PickerSheet>

      <PickerSheet
        open={picker === "alerts"}
        onClose={() => setPicker(null)}
        title="Alerts"
      >
        <AlertsPicker
          reminders={draft.reminders}
          due={draft.due}
          today={today}
          onChange={(reminders) => onChange({ reminders })}
        />
      </PickerSheet>

      <NoteEditor
        open={noteOpen}
        text={noteText(draft.body)}
        onClose={(text) => {
          if (text != null) {
            onChange({ body: bodyOf(text) });
          }
          setNoteOpen(false);
        }}
      />
    </>
  );
}

/**
 * One property with a value: its label and words, a clear control where
 * one exists, and the press target that opens its picker.
 */
function PropertyTile({
  property,
  draft,
  today,
  onPress,
  onClear,
}: {
  property: Property;
  draft: TaskEdit;
  today: Date;
  onPress: () => void;
  onClear: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const canClear = property.clear(draft) != null;
  return (
    <View style={[styles.tile, property.wide && styles.tileWide]}>
      <Pressable
        style={({ pressed }) => [styles.tileMain, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={property.names.open}
      >
        <View style={styles.tileHead}>
          <Icon name={property.icon} color="inkMuted" />
          <Text style={styles.tileTitle}>{property.title}</Text>
        </View>
        <Text style={styles.tileWords} numberOfLines={property.wide ? 2 : 1}>
          {property.words(draft, today)}
        </Text>
      </Pressable>
      {canClear ? (
        <IconButton label={property.names.clear} onPress={onClear}>
          <Icon name="close" />
        </IconButton>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
    },
    listButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      minHeight: touchTarget,
      borderRadius: radii.pill,
    },
    listName: {
      flexShrink: 1,
      ...type.control,
      fontWeight: "600",
      color: colors.ink,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.s,
    },
    tick: {
      width: touchTarget,
      height: touchTarget,
      alignItems: "center",
      justifyContent: "center",
    },
    tickRing: {
      width: 22,
      height: 22,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: colors.inkFaint,
    },
    tickRingEmpty: {
      borderColor: colors.hairline,
    },
    title: {
      flex: 1,
      ...type.title,
      fontWeight: "600",
      color: colors.ink,
      paddingTop: spacing.s,
      paddingBottom: spacing.s,
    },
    body: {
      gap: spacing.m,
      paddingBottom: spacing.s,
    },
    tiles: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.s,
    },
    tile: {
      flexGrow: 1,
      flexBasis: "46%",
      flexDirection: "row",
      alignItems: "flex-start",
      borderRadius: radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      backgroundColor: colors.paper,
      paddingLeft: spacing.m,
    },
    tileWide: {
      flexBasis: "100%",
    },
    tileMain: {
      flex: 1,
      gap: spacing.xs,
      paddingVertical: spacing.m,
      paddingRight: spacing.s,
      borderRadius: radii.pill,
    },
    tileHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    tileTitle: {
      ...type.caption,
      fontWeight: "600",
      color: colors.inkMuted,
    },
    tileWords: {
      ...type.control,
      color: colors.ink,
    },
    strip: {
      gap: spacing.s,
      paddingRight: spacing.s,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      minHeight: touchTarget,
      paddingHorizontal: spacing.m,
      borderRadius: radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
    },
    chipText: {
      ...type.control,
      fontWeight: "600",
      color: colors.inkMuted,
    },
  }),
});
