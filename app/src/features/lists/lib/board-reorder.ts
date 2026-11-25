import { createReorderSurface } from "@/components/motion/reorder";
import type { TaskItem } from "@/types/task";
import type { BoardStatus } from "./board";

/** A card on the board: the deed and the group it sits in. */
export type BoardCard = { task: TaskItem; status: BoardStatus };

/** The board's one reorder surface. */
export const BoardReorder = createReorderSurface<BoardCard>();
