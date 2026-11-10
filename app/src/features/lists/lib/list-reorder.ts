import { createReorderSurface } from "@/components/motion/reorder";
import type { TaskItem } from "@/types/task";

/** The lists screen's one reorder surface. */
export const ListReorder = createReorderSurface<TaskItem>();
