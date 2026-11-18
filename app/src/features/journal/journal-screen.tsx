import * as React from "react";
import {
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomBar } from "@/components/bottom-bar/bottom-bar";
import type { JournalDockSlot } from "@/components/bottom-bar/dock-slot";
import { PagePull } from "@/components/motion/pull";
import { MotionScrollView } from "@/components/motion/scroll-view";
import { ErrorState, LoadingState } from "@/components/ui/list-states";
import { VaultPrompt } from "@/components/ui/vault-prompt";
import { useCommandPane } from "@/hooks/use-command-pane";
import { useToday } from "@/hooks/use-today";
import { journalPage } from "@/lib/journal/format";
import { useVault } from "@/lib/vault/vault-provider";
import {
  useGrantFolder,
  useJournalNote,
  useRefreshJournal,
} from "@/stores/journal/use-journal-note";
import { journal, measure, pageGutter, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { isoOf } from "@/utils/dates";
import { JournalHeader } from "./components/journal-header";
import { JournalHeading } from "./components/journal-heading";
import { JournalPaper } from "./components/journal-paper";
import { ReferenceSheet } from "./components/reference-sheet";
import { STICK_SLOP } from "./lib/page-grid";

/**
 * The Journal tab. Today's note as a ruled page under a fixed header,
 * with the composer in the bottom bar's action slot.
 *
 * The screen is a column: header, the page, the bar. The header holds
 * the month and the day's food count. The day is the page's serif title,
 * so it scrolls with the writing. The page opens at its newest line and
 * follows a sent entry down, but a reader who scrolled up keeps their
 * place.
 *
 * It reads no task state. The note is its own query.
 */
export default function JournalScreen({ dock }: { dock: JournalDockSlot }) {
  const { styles } = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { show: showCommands } = useCommandPane();
  const day = isoOf(useToday());
  const read = useJournalNote(day);
  const refresh = useRefreshJournal(day);
  const grantFolder = useGrantFolder(day);
  const { root, booted } = useVault();

  // The page is derived from the note's text on every read of it, so
  // there is no second copy of the journal anywhere.
  const page = React.useMemo(
    () => journalPage(day, read.text),
    [day, read.text],
  );

  const [reference, setReference] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    await refresh();
  }, [refresh]);

  // The page follows its end only while the reader is there. The first
  // content size jumps without motion; a send scrolls with it. A reader
  // who scrolled up is never yanked by a read that landed behind them.
  const scroller = React.useRef<React.ComponentRef<typeof MotionScrollView>>(null);
  const stick = React.useRef(true);
  const first = React.useRef(true);
  const size = React.useRef({ height: 0, view: 0 });

  const scrollToEnd = React.useCallback((animated: boolean) => {
    scroller.current?.scrollToEnd({ animated });
  }, []);

  const onContentSizeChange = React.useCallback(
    (_width: number, height: number) => {
      size.current.height = height;
      if (first.current) {
        first.current = false;
        scrollToEnd(false);
        return;
      }
      if (stick.current) {
        scrollToEnd(true);
      }
    },
    [scrollToEnd],
  );

  // A send follows the end even when the reader had scrolled up: the
  // block they just wrote is the one they want to see. The dock bumps
  // this, and the effect below runs after the block has its height.
  const [sent, setSent] = React.useState(0);
  const sentOnce = React.useRef(false);
  React.useEffect(() => {
    if (!sentOnce.current) {
      sentOnce.current = true;
      return;
    }
    stick.current = true;
    scrollToEnd(true);
  }, [sent, scrollToEnd]);

  const onScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      stick.current =
        size.current.height - y - size.current.view <= STICK_SLOP;
    },
    [],
  );

  return (
    <View testID="journal-screen" style={styles.screen}>
      <View style={[styles.statusStrip, { height: insets.top }]} />
      <JournalHeader day={day} foodCount={page.food.length} />
      <View style={styles.body}>
        {root == null && booted ? (
          <VaultPrompt
            onGrant={() => void grantFolder()}
            hint="Pick the Obsidian vault to keep a journal in."
          />
        ) : null}
        <PagePull onPull={showCommands}>
          <MotionScrollView
            ref={scroller}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            onContentSizeChange={onContentSizeChange}
            onLayout={(event) => {
              size.current.view = event.nativeEvent.layout.height;
            }}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            <JournalHeading day={day} />
            {read.status === "loading" ? (
              <LoadingState label="Reading today's note" />
            ) : read.status === "error" ? (
              <ErrorState
                message={read.error ?? "Something went wrong."}
                onRetry={() => void reload()}
                retryLabel="retry journal read"
              />
            ) : (
              <JournalPaper page={page} onReference={setReference} />
            )}
          </MotionScrollView>
        </PagePull>
      </View>
      <BottomBar
        action={dock({ day, onSend: () => setSent((count) => count + 1) })}
      />
      <ReferenceSheet name={reference} onClose={() => setReference(null)} />
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
      backgroundColor: colors.surface,
    },
    body: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    // The content holds to the reading measure, and ends on one ruled
    // line so the page never stops between rules.
    content: {
      flexGrow: 1,
      maxWidth: measure,
      width: "100%",
      alignSelf: "center",
      paddingHorizontal: pageGutter,
      paddingBottom: journal.line,
    },
  }),
});
