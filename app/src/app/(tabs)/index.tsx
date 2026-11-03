import { CaptureDock } from "@/features/capture/components/capture-dock";
import { ListsScreen } from "@/features/lists/lists-screen";
import type { DockSlot } from "@/components/bottom-bar/dock-slot";

const dock: DockSlot = (slot) => <CaptureDock {...slot} />;

/** The Lists tab. The route composes the screen with the capture dock
    (ADR 0039): a screen never imports a feature beside it. */
export default function ListsRoute() {
  return <ListsScreen dock={dock} />;
}
