import InboxNotesScreen from "@/features/inbox-notes/inbox-notes-screen";
import { NoteDock } from "@/features/inbox-notes/components/note-dock";

/** The Inbox Notes tab. The route composes the screen with the notes
    dock (ADR 0039): a screen never imports a feature beside it. */
export default function InboxRoute() {
  return <InboxNotesScreen dock={<NoteDock />} />;
}
