import { router } from "expo-router";

/** Open a task the way its row does, from one encoded id segment. */
export function openTask(id: string): void {
  router.push(`/task/${encodeURIComponent(id)}`);
}
