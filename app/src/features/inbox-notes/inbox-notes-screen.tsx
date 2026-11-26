import * as React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomBar } from "@/components/bottom-bar/bottom-bar";
import { ScrollEdge } from "@/components/motion/scroll-edge";
import { renderMotionScroll } from "@/components/motion/scroll-view";
import { Banner } from "@/components/ui/banner";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/list-states";
import { VaultPrompt } from "@/components/ui/vault-prompt";
import { useStableCallback } from "@/hooks/use-stable-callback";
import { matchesQuery, type InboxNote } from "@/lib/inbox-notes/model";
import { useSetting } from "@/lib/settings-store";
import { useInboxNotes } from "@/stores/inbox-notes/use-inbox-notes";
import { pageGutter, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { InboxHeader } from "./components/inbox-header";
import { NoteCard } from "./components/note-card";

/**
 * The Inbox Notes tab: the notes in the vault's Inbox folder, newest
 * first, as a card grid of one column or two, filtered by the search
 * in the header. The composer lives in the dock the
 * route passes in, so the bar holds one action on every tab.
 */
export default function InboxNotesScreen({ dock }: { dock: React.ReactNode }) {
  const { styles } = useThemedStyles(makeStyles);
  const {
    notes,
    status,
    folder,
    unreadable,
    readError,
    refresh,
    grant,
  } = useInboxNotes();
  const insets = useSafeAreaInsets();
  const [columns, setColumns] = useSetting("inboxColumns");
  const [query, setQuery] = React.useState("");

  const shown = React.useMemo(
    () => notes.filter((note) => matchesQuery(note, query)),
    [notes, query],
  );
  const searching = query.trim() !== "";

  const reload = React.useCallback(async () => {
    await refresh();
  }, [refresh]);

  const open = useStableCallback((note: InboxNote) => {
    router.push(`/note/${encodeURIComponent(note.uri)}`);
  });

  // A lone last card keeps its column width, as a Keep board does.
  const cards: (InboxNote | null)[] =
    columns === "two" && shown.length % 2 === 1 ? [...shown, null] : shown;

  const empty =
    status === "loading" ? (
      <LoadingState label="Loading notes" />
    ) : status === "error" || status === "novault" ? null : (
      <EmptyState
        label={
          searching
            ? `No notes match "${query.trim()}".`
            : folder == null
              ? "No notes yet. The first note makes the Inbox folder."
              : "No notes yet. Tap Add to write one."
        }
      />
    );

  return (
    <View testID="inbox-notes-screen" style={styles.screen}>
      <View style={[styles.statusStrip, { height: insets.top }]} />
      <InboxHeader
        shown={shown.length}
        total={notes.length}
        query={query}
        onQueryChange={setQuery}
        columns={columns}
        onToggleColumns={() => setColumns(columns === "two" ? "one" : "two")}
      />

      {status === "novault" ? (
        <VaultPrompt
          hint="Pick the Obsidian vault that holds your Inbox."
          onGrant={() => void grant()}
        />
      ) : null}
      {status === "error" ? (
        <View style={styles.notice}>
          <ErrorState
            message={readError ?? "The Inbox could not be read."}
            onRetry={() => void reload()}
          />
        </View>
      ) : null}
      {unreadable.length > 0 ? (
        <View style={styles.notice}>
          <Banner
            tone="info"
            lines={[`${unreadable.length} notes could not be read.`]}
            actions={[
              {
                label: "Retry",
                accessibilityLabel: "retry inbox read",
                onPress: () => void reload(),
              },
            ]}
          />
        </View>
      ) : null}

      <View style={styles.list}>
        <FlatList
          key={columns}
          data={cards}
          keyExtractor={(item, index) => item?.uri ?? `pad-${index}`}
          numColumns={columns === "two" ? 2 : 1}
          columnWrapperStyle={columns === "two" ? styles.row : undefined}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          renderScrollComponent={renderMotionScroll}
          ListEmptyComponent={empty ?? undefined}
          renderItem={({ item }) =>
            item == null ? (
              <View style={styles.fill} />
            ) : (
              <NoteCard
                note={item}
                onPress={open}
                wide={columns === "one"}
              />
            )
          }
        />
        <ScrollEdge testID="inbox-edge" />
      </View>

      <BottomBar action={dock} />
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.paper,
    },
    statusStrip: {
      backgroundColor: colors.paper,
    },
    notice: {
      paddingHorizontal: pageGutter,
      paddingBottom: spacing.s,
    },
    list: {
      flex: 1,
    },
    content: {
      paddingHorizontal: pageGutter,
      paddingTop: spacing.m,
      paddingBottom: spacing.xxl,
      gap: spacing.s,
      flexGrow: 1,
    },
    row: {
      gap: spacing.s,
    },
    fill: {
      flex: 1,
    },
  }),
});
