import * as React from "react";
import { useProgress, type Progress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";

/**
 * A sheet's one clock. `open` is the intent. `mounted` holds the sheet
 * in the tree while its exit plays, and lets it go once the clock
 * reaches closed.
 */
export function useSheetClock(open: boolean): {
  mounted: boolean;
  progress: Progress;
} {
  const [mounted, setMounted] = React.useState(open);
  if (open && !mounted) {
    setMounted(true);
  }
  const progress = useProgress(open, {
    ms: motion.ms.sheet,
    onSettled: (at) => at === 0 && setMounted(false),
  });
  return { mounted: open || mounted, progress };
}
