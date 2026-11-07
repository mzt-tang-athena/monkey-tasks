import { CaptureDock } from "@/features/capture/components/capture-dock";
import PlannerScreen from "@/features/planner/planner-screen";
import type { DockSlot } from "@/components/bottom-bar/dock-slot";

const dock: DockSlot = (slot) => <CaptureDock {...slot} />;

/** The Planner tab. The route composes the screen with the capture
    dock (ADR 0039): a screen never imports a feature beside it. */
export default function PlannerRoute() {
  return <PlannerScreen dock={dock} />;
}
