import * as React from "react";
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotionScrollView } from "@/components/motion/scroll-view";
import { PreviewRow } from "@/components/preview-row";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { CardGroupRow } from "@/components/ui/card-group-row";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/list-states";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import { SegmentedControl, type Segment } from "@/components/ui/segmented-control";
import { TabStrip } from "@/components/ui/tab-strip";
import { TextField } from "@/components/ui/text-field";
import {
  THEME_NAMES,
  measure,
  pageGutter,
  radius,
  spacing,
  type,
  type Palette,
  type ThemeName,
} from "@/theme/tokens";
import { useTheme, useThemedStyles } from "@/theme/theme-provider";
import type { TaskItem } from "@/types/task";
import { Focused } from "./components/focused";
import { OverlayStage, type OverlayName } from "./components/overlay-stage";
import { PressTarget } from "./components/press-target";
import {
  GALLERY_SECTIONS,
  stateTestId,
  type GalleryStateId,
} from "./model";

const noop = () => undefined;

const plannerModes: Segment<"day" | "week" | "month">[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

const listTabs = ["Main", "Errands", "Focus"];

/** A task for the row face. The face reads the name and the done flag. */
function rowTask(name: string): TaskItem {
  return {
    id: name,
    uri: `gallery:${name}`,
    fileName: `${name}.md`,
    name,
    text: "",
    data: null,
    body: "",
  };
}

function isThemeName(value: string | undefined): value is ThemeName {
  return value != null && value in THEME_NAMES;
}

/**
 * The review surface for the primitives: every state, labelled, in the
 * active palette. It ships in the bundle and has no production entry
 * point, so state drift shows up here in review instead of on a screen.
 * GALLERY_SECTIONS owns the order and the labels, and this map owns one
 * node per state, so the two cannot drift apart.
 */
export default function GalleryScreen() {
  const { styles } = useThemedStyles(makeStyles);
  const { name, setTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const params = useLocalSearchParams<{ palette?: string }>();
  const [overlay, setOverlay] = React.useState<OverlayName | null>(null);
  const menuAnchor = React.useRef<React.ComponentRef<typeof View>>(null);

  // A reviewer opens /gallery?palette=clay and screenshots it by hand.
  // The end-to-end suite switches palettes through `globalThis.__setTheme`.
  const asked = React.useRef(false);
  React.useEffect(() => {
    if (asked.current) {
      return;
    }
    asked.current = true;
    if (isThemeName(params.palette)) {
      setTheme(params.palette);
    }
  }, [params.palette, setTheme]);

  const nodes: Record<GalleryStateId, React.ReactNode> = {
    "button:primary": <Button label="Save task" onPress={noop} />,
    "button:secondary": (
      <Button variant="quiet" label="Add to list" onPress={noop} />
    ),
    "button:text": <Button variant="text" label="Cancel" onPress={noop} />,
    "button:disabled": <Button label="Save task" onPress={noop} disabled />,

    "pressable:rest": <PressTarget paint="rest" testID="gallery-press-rest" />,
    "pressable:pressed": (
      <PressTarget paint="pressed" testID="gallery-press-pressed" />
    ),
    "pressable:focused": (
      <Focused>
        <PressTarget paint="rest" testID="gallery-press-focused" />
      </Focused>
    ),

    "icon-button:rest": (
      <IconButton label="sort tasks">
        <Icon name="sort" />
      </IconButton>
    ),
    "icon-button:active": (
      <IconButton label="sort tasks, active" active>
        <Icon name="sort" color="accent" />
      </IconButton>
    ),
    "icon-button:focused": (
      <Focused>
        <IconButton label="sort tasks, focused">
          <Icon name="sort" />
        </IconButton>
      </Focused>
    ),

    "segmented-control:selected": (
      <View style={styles.wide}>
        <SegmentedControl
          segments={plannerModes}
          selected="week"
          onSelect={noop}
          label="planner modes"
          stretch
        />
      </View>
    ),

    "tab-strip:selected": (
      <TabStrip
        label="list tabs"
        tabs={listTabs}
        selected="Errands"
        onSelect={noop}
      />
    ),

    "pill:control": <Pill label="Tomorrow" onPress={noop} />,
    "pill:chip": (
      <Pill label="15:00" tone="chip">
        <Icon name="clock-mini" />
      </Pill>
    ),

    "text-field:rest": (
      <View style={styles.wide}>
        <TextField label="Task name" defaultValue="Buy milk" />
      </View>
    ),
    "text-field:focused": (
      <View style={styles.wide}>
        <Focused>
          <TextField label="Task name" defaultValue="Buy milk" />
        </Focused>
      </View>
    ),
    "text-field:error": (
      <View style={styles.wide}>
        <TextField
          label="Task name"
          error="A task needs a name."
          defaultValue=""
        />
      </View>
    ),

    "banner:danger": (
      <View style={styles.wide}>
        <Banner
          tone="danger"
          title="Write failed"
          lines={["The note could not be saved."]}
          actions={[{ label: "Retry", onPress: noop }]}
        />
      </View>
    ),
    "banner:info": (
      <View style={styles.wide}>
        <Banner
          tone="info"
          title="Synced"
          lines={["Every note is up to date."]}
        />
      </View>
    ),

    "list-states:loading": (
      <View style={styles.wide}>
        <LoadingState />
      </View>
    ),
    "list-states:empty": (
      <View style={styles.wide}>
        <EmptyState label="No tasks here yet." />
      </View>
    ),
    "list-states:error": (
      <View style={styles.wide}>
        <ErrorState message="The list could not load." onRetry={noop} />
      </View>
    ),

    "section-header:accent": <SectionHeader label="Today" count={3} />,
    "section-header:danger": (
      <SectionHeader label="Needs repair" tone="danger" />
    ),
    "section-header:muted": <SectionHeader label="Done" tone="muted" />,
    "section-header:faint": <SectionHeader label="Archived" tone="faint" />,

    "card-group-row:group": (
      <View style={styles.wide}>
        <CardGroupRow position="first">
          <PreviewRow task={rowTask("Rest row")} />
        </CardGroupRow>
        <CardGroupRow position="middle">
          <PreviewRow task={rowTask("Done row")} done />
        </CardGroupRow>
        <CardGroupRow position="last">
          <PreviewRow task={rowTask("Last row")} />
        </CardGroupRow>
      </View>
    ),

    "task-row:rest": (
      <View style={styles.wide}>
        <CardGroupRow position="only">
          <PreviewRow task={rowTask("Rest row")} />
        </CardGroupRow>
      </View>
    ),
    "task-row:done": (
      <View style={styles.wide}>
        <CardGroupRow position="only">
          <PreviewRow task={rowTask("Done row")} done />
        </CardGroupRow>
      </View>
    ),
    "task-row:selected": (
      <View style={styles.selected}>
        <PreviewRow task={rowTask("Selected row")} />
      </View>
    ),

    "menu:open": (
      <View ref={menuAnchor}>
        <Button
          variant="quiet"
          label="Open menu"
          onPress={() => setOverlay("menu")}
        />
      </View>
    ),
    "sheet:open": (
      <Button
        variant="quiet"
        label="Open sheet"
        onPress={() => setOverlay("sheet")}
      />
    ),
    "command-pane:open": (
      <Button
        variant="quiet"
        label="Open command pane"
        onPress={() => setOverlay("command-pane")}
      />
    ),
    "toast:open": (
      <Button
        variant="quiet"
        label="Show toast"
        onPress={() => setOverlay("toast")}
      />
    ),

    "overlay-host:mounts": (
      <Text style={styles.note}>
        The menu, sheet, command pane and toast above all draw through the
        app&apos;s overlay host, above every screen and the bottom bar.
      </Text>
    ),
  };

  return (
    <View
      testID="gallery"
      style={[styles.screen, { paddingTop: insets.top }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Button
          variant="text"
          tone="muted"
          label="Back"
          accessibilityLabel="back"
          onPress={() => router.back()}
        />
      </View>
      <MotionScrollView
        testID="gallery-scroll"
        contentContainerStyle={styles.content}
      >
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.title}>
            Component gallery
          </Text>
          <Text testID="gallery-context" style={styles.context}>
            {`${THEME_NAMES[name]} at ${window.width} wide`}
          </Text>
          <Text style={styles.note}>
            A browser focuses one control at a time, so the focused cells ring
            in Tab order.
          </Text>
        </View>

        {GALLERY_SECTIONS.map((section) => (
          <View
            key={section.id}
            testID={`gallery-section:${section.id}`}
            style={styles.section}
          >
            <SectionHeader label={section.title} tone="muted" />
            <View style={styles.cells}>
              {section.states.map((state) => (
                <View
                  key={state.id}
                  testID={stateTestId(state.id)}
                  style={styles.cell}
                >
                  <Text testID="gallery-state-label" style={styles.stateLabel}>
                    {state.label}
                  </Text>
                  <View style={styles.stage}>{nodes[state.id]}</View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </MotionScrollView>

      <OverlayStage
        open={overlay}
        anchor={menuAnchor}
        onClose={() => setOverlay(null)}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.paper,
    },
    // The back button spans the window; its row holds to the measure.
    header: {
      maxWidth: measure,
      width: "100%",
      alignSelf: "center",
      alignItems: "flex-start",
      paddingHorizontal: pageGutter - spacing.s,
      paddingVertical: spacing.s,
    },
    content: {
      maxWidth: measure,
      width: "100%",
      alignSelf: "center",
      paddingHorizontal: pageGutter,
      paddingBottom: spacing.xxl,
      gap: spacing.xl,
    },
    intro: {
      gap: spacing.xs,
    },
    title: {
      ...type.title,
      color: colors.ink,
    },
    context: {
      ...type.control,
      color: colors.accent,
      fontWeight: "600",
    },
    section: {
      gap: spacing.s,
    },
    cells: {
      gap: spacing.s,
    },
    cell: {
      backgroundColor: colors.surface,
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      padding: spacing.m,
      gap: spacing.s,
      alignItems: "flex-start",
    },
    stateLabel: {
      ...type.eyebrow,
      color: colors.inkMuted,
    },
    stage: {
      width: "100%",
      alignItems: "flex-start",
      gap: spacing.s,
    },
    wide: {
      width: "100%",
    },
    selected: {
      width: "100%",
      borderRadius: radius,
      backgroundColor: colors.accentSoft,
    },
    note: {
      ...type.meta,
      color: colors.inkMuted,
    },
  }),
});
