import * as React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardState } from "react-native-keyboard-controller";
import { MotionScrollView } from "@/components/motion/scroll-view";
import { useTickBurst } from "@/components/motion/celebration";
import { SheetGrab } from "@/components/motion/sheet-drag";
import { ReferencePicker } from "@/components/references/reference-picker";
import { ReferenceSheet } from "@/components/references/reference-sheet";
import { Banner } from "@/components/ui/banner";
import {
  EdgeFade,
  fadedEdges,
  fadeReach,
  type FadeBox,
} from "@/components/ui/edge-fade";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { PickerSheet } from "@/components/ui/picker-sheet";
import {
  attachReference,
  detachReference,
  parseReferences,
} from "@/lib/references/links";
import type { Progress } from "@/lib/motion/progress";
import { useReferenceNotes } from "@/stores/references/use-references";
import type { TaskEdit } from "@/types/task";
import {
  radii,
  radius,
  spacing,
  touchTarget,
  type,
  type Palette,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { useClampedHeight } from "@/hooks/use-clamped-height";
import { bodyOf, noteText, PROPERTIES, type Property } from "../model";
import type { WriteFailure, WriteState } from "../lib/session";
import { AlertsPicker } from "./alerts-picker";
import { DuePicker } from "./due-picker";
import { ListPicker } from "./list-picker";
import { NoteEditor } from "./note-editor";
import { ReferenceTile } from "./reference-tile";
import { RepeatPicker } from "./repeat-picker";
import { StatusPicker } from "./status-picker";

// A browser textarea holds two rows by default. The title follows its
// text instead, as a native multiline input does.
const autoSizedTitle = Platform.select({
  web: { fieldSizing: "content" } as unknown as TextStyle,
  default: {},
});

/** The sheet's open pickers: one at a time, over the editor. */
export type Picker =
  | "status"
  | "due"
  | "repeat"
  | "list"
  | "alerts"
  | "reference"
  | null;

/**
 * The task editor's sheet: the list, the menu, the title, then the
 * tiles of the properties that have a value and the strip of chips for
 * the ones that do not. A tile opens its picker, or the note editor.
 * Every change is already written when the sheet closes.
 */
export function EditorSheet({
  open,
  progress,
  initialPicker = null,
  draft,
  done,
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
  /** The picker already open as the sheet shows. */
  initialPicker?: Picker;
  draft: TaskEdit;
  /** The task is already done, so the tick reopens it. */
  done: boolean;
  today: Date;
  lists: string[];
  write: WriteState;
  onChange: (patch: Partial<TaskEdit>) => void;
  onRetry: () => void;
  onClose: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const { ref: tickRef, play: celebrate } = useTickBurst(done, "sheet");
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const keyboard = useKeyboardState((state) => state.height);
  const [picker, setPicker] = React.useState<Picker>(initialPicker);
  const [noteOpen, setNoteOpen] = React.useState(false);
  // The linked note the preview shows, by name, or null.
  const [preview, setPreview] = React.useState<string | null>(null);
  const references = useReferenceNotes();
  const linked = parseReferences(draft.body);
  // The field's text as typed, or null when it holds the draft's name.
  // A press handler belongs to an earlier render, so the typed text is
  // a ref the field writes on every keystroke. The field reads the
  // draft's name, so a rename that lands elsewhere shows here.
  const [title, setTitle] = React.useState<string | null>(null);
  const typed = React.useRef(draft.name);
  const [menu, setMenu] = React.useState(false);
  // The tiles and the strip scroll inside the room above the keyboard,
  // so the title never leaves the screen.
  const cap = Math.max(120, window.height * 0.55 - keyboard - insets.top);
  const body = useClampedHeight(cap);
  const menuAnchor = React.useRef<React.ComponentRef<typeof View>>(null);

  // A draft name that changed elsewhere, such as a retried write, reads
  // back into the field.
  const [shownName, setShownName] = React.useState(draft.name);
  if (shownName !== draft.name) {
    setShownName(draft.name);
    setTitle(null);
  }
  React.useEffect(() => {
    typed.current = draft.name;
  }, [draft.name]);

  // A title writes on blur, on submit and on close, never per keystroke:
  // a rename writes a new file under SAF. An empty title never writes.
  const commitTitle = () => {
    const name = typed.current.trim();
    setTitle(null);
    if (name === "") {
      typed.current = draft.name;
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
    (property) =>
      !property.onlyWhenSet &&
      (property.many || !property.isSet(draft)),
  );

  return (
    <>
      <Sheet
        open={open}
        onDismiss={close}
        progress={progress}
        rideKeyboard
        scrim
        covered={picker != null || noteOpen || preview != null}
        label="Task"
        closeLabel="close the task"
      >
        {write.kind === "failed" ? (
          // The raw error stays out: it names a file call, not a next step.
          <Banner
            tone="danger"
            actions={[
              {
                label: "Retry",
                accessibilityLabel: "retry save",
                onPress: onRetry,
              },
            ]}
          >
            <Text style={styles.failedTitle}>Not saved.</Text>
            <Text style={styles.failedLine}>{failedWords[write.reason]}</Text>
          </Banner>
        ) : null}
        {/* Only the header row grabs: the body below scrolls and keeps
            its own drags. */}
        <SheetGrab>
          <View style={styles.header}>
            <Pressable
              style={({ pressed }) => [styles.listButton, pressed && styles.pressed]}
              onPress={() => {
                commitTitle();
                setPicker("list");
              }}
              accessibilityRole="button"
              // The visible name is the list's, so the control's name
              // carries it (WCAG 2.5.3).
              accessibilityLabel={`change list, ${draft.list ?? "Main"}`}
            >
              <Icon name="list" size={22} color="inkMuted" />
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
        </SheetGrab>
        <View style={styles.titleRow}>
          <Pressable
            style={styles.tick}
            onPress={() => {
              celebrate();
              onToggle();
            }}
            accessibilityRole="button"
            accessibilityLabel={done ? "mark not done" : "mark done"}
          >
            <View
              ref={tickRef}
              style={[
                styles.tickRing,
                done && styles.tickRingDone,
                !done && draft.name === "" && styles.tickRingEmpty,
              ]}
            >
              {done ? <Text style={styles.tickCheck}>{"✓"}</Text> : null}
            </View>
          </Pressable>
          <TextInput
            value={title ?? draft.name}
            onChangeText={(text) => {
              typed.current = text;
              setTitle(text);
            }}
            onBlur={commitTitle}
            onSubmitEditing={commitTitle}
            multiline
            placeholder="Task name"
            placeholderTextColor={colors.inkFaint}
            selectionColor={colors.accent}
            aria-label="Task name"
            style={[styles.title, autoSizedTitle]}
          />
        </View>
        <MotionScrollView
          style={{ height: body.height, maxHeight: cap }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.body} onLayout={body.onLayout}>
            {showing.length > 0 ? (
              <View style={styles.tiles}>
                {showing.map((property) =>
                  property.key === "reference" ? (
                    <ReferenceTile
                      key={property.key}
                      names={linked}
                      onOpen={setPreview}
                      onRemove={(name) =>
                        onChange({ body: detachReference(draft.body, name) })
                      }
                      onAdd={() => setPicker("reference")}
                    />
                  ) : (
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
                  ),
                )}
              </View>
            ) : null}
            {missing.length > 0 ? (
              <AddStrip properties={missing} onPick={openPicker} />
            ) : null}
          </View>
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
        open={picker === "status"}
        onClose={() => setPicker(null)}
        title="Status"
      >
        <StatusPicker
          current={draft.status ?? null}
          onPick={(status) => {
            // Done is the tick's path, so `completed` and a repeat's
            // next note stay in one write.
            if (status === "[[done]]") {
              if (!done) {
                celebrate();
                onToggle();
              }
              return;
            }
            onChange({ status });
          }}
          onClose={() => setPicker(null)}
        />
      </PickerSheet>

      <PickerSheet
        open={picker === "due"}
        onClose={() => setPicker(null)}
        title="Due"
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
          weight={draft.alertWeight}
          today={today}
          onChange={(reminders) => onChange({ reminders })}
          onWeight={(alertWeight) => onChange({ alertWeight })}
        />
      </PickerSheet>

      <ReferencePicker
        open={picker === "reference"}
        onClose={() => setPicker(null)}
        notes={references.notes}
        attached={linked}
        onAttach={(name) =>
          onChange({ body: attachReference(draft.body, name) })
        }
        error={references.error}
      />

      <ReferenceSheet
        open={preview != null}
        name={preview ?? ""}
        note={
          preview == null
            ? null
            : (references.notes?.find((note) => note.name === preview) ?? null)
        }
        loading={
          preview != null &&
          references.notes == null &&
          references.error == null
        }
        onClose={() => setPreview(null)}
        onDetach={() => {
          if (preview != null) {
            onChange({ body: detachReference(draft.body, preview) });
            setPreview(null);
          }
        }}
      />

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

/** A chip's padding, and the space between two chips. */
const chipSpace = { inset: spacing.xs, gap: spacing.s };

/**
 * The chips of the properties with no value, in one row. A row wider
 * than the sheet scrolls, and the edge that hides a chip fades.
 */
function AddStrip({
  properties,
  onPick,
}: {
  properties: Property[];
  onPick: (property: Property) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const [frame, setFrame] = React.useState({ view: 0, content: 0, x: 0 });
  const [places, setPlaces] = React.useState<Record<string, FadeBox>>({});
  const fade = fadedEdges(frame);
  const boxes = properties.map((property) => places[property.key] ?? null);
  return (
    <View>
      <MotionScrollView
        horizontal
        style={styles.stripScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        scrollEventThrottle={16}
        onLayout={(event: LayoutChangeEvent) => {
          const view = event.nativeEvent.layout.width;
          setFrame((current) => ({ ...current, view }));
        }}
        onContentSizeChange={(content) =>
          setFrame((current) => ({ ...current, content }))
        }
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const x = event.nativeEvent.contentOffset.x;
          setFrame((current) => ({ ...current, x }));
        }}
      >
        {properties.map((property) => (
          <Pressable
            key={property.key}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            onPress={() => onPick(property)}
            onLayout={(event: LayoutChangeEvent) => {
              const { x, width } = event.nativeEvent.layout;
              setPlaces((current) => {
                const place = current[property.key];
                if (place?.x === x && place.width === width) {
                  return current;
                }
                return { ...current, [property.key]: { x, width } };
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={property.names.add}
          >
            <Icon name={property.icon} size={glyph} />
            <Text style={styles.chipText}>{property.chip}</Text>
          </Pressable>
        ))}
      </MotionScrollView>
      {fade.start ? (
        <EdgeFade
          side="start"
          reach={fadeReach("start", frame, boxes, chipSpace)}
          testID="strip-fade-start"
        />
      ) : null}
      {fade.end ? (
        <EdgeFade
          side="end"
          reach={fadeReach("end", frame, boxes, chipSpace)}
          testID="strip-fade-end"
        />
      ) : null}
    </View>
  );
}

/** What a failed write means for the user, by its reason. */
const failedWords: Record<WriteFailure, string> = {
  changed: "The note changed on disk. Retry writes this change onto it.",
  gone: "The task is no longer in the vault.",
  failed: "The file did not change. Retry writes it again.",
};

/** A property's glyph, sized to read beside its label. */
const glyph = 18;

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
  const aside = property.aside?.(draft) ?? null;
  return (
    <View style={[styles.tile, property.wide && styles.tileWide]}>
      <Pressable
        style={({ pressed }) => [styles.tileMain, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={property.names.open}
      >
        <View style={styles.tileHead}>
          <Icon name={property.icon} size={glyph} />
          <Text style={styles.tileTitle}>{property.title}</Text>
        </View>
        <Text style={styles.tileWords} numberOfLines={2}>
          {property.words(draft, today)}
          {aside == null ? null : <Text style={styles.tileAside}>{` · ${aside}`}</Text>}
        </Text>
      </Pressable>
      {/* The clear control sits in the corner, so the value keeps the
          tile's full width. */}
      {canClear ? (
        <View style={styles.tileClear}>
          <IconButton label={property.names.clear} onPress={onClear}>
            <Icon name="close" />
          </IconButton>
        </View>
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
    failedTitle: {
      ...type.control,
      fontWeight: "600",
      color: colors.danger,
    },
    failedLine: {
      ...type.meta,
      color: colors.danger,
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
      alignItems: "center",
      justifyContent: "center",
    },
    tickRingDone: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    tickRingEmpty: {
      borderColor: colors.hairline,
    },
    tickCheck: {
      color: colors.onAccent,
      fontSize: 12,
      lineHeight: 14,
      fontWeight: "600",
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
    // Two per row. A tile alone in its row keeps half the width, so the
    // grid reads as a grid.
    tile: {
      flexGrow: 0,
      flexBasis: "48%",
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      backgroundColor: colors.paper,
    },
    tileWide: {
      flexBasis: "100%",
    },
    tileMain: {
      gap: spacing.xs,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.m,
      borderRadius: radius,
    },
    tileClear: {
      position: "absolute",
      top: 0,
      right: 0,
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
    tileAside: {
      color: colors.inkMuted,
    },
    stripScroll: {
      flexGrow: 0,
      width: "100%",
    },
    strip: {
      gap: spacing.s,
    },
    // A light chip: no border, so the four default chips fit a 360
    // wide screen. The set values above stay cards.
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      minHeight: touchTarget,
      paddingHorizontal: spacing.xs,
      borderRadius: radius,
    },
    chipText: {
      ...type.control,
      color: colors.inkMuted,
    },
  }),
});
