import type { JournalDockSlot } from "@/components/bottom-bar/dock-slot";
import { JournalDock } from "@/features/journal/components/journal-dock";
import JournalScreen from "@/features/journal/journal-screen";

const dock: JournalDockSlot = (slot) => <JournalDock {...slot} />;

/** The Journal tab. The route composes the screen with the journal dock
    (ADR 0039): a screen never imports a feature beside it. */
export default function JournalRoute() {
  return <JournalScreen dock={dock} />;
}
