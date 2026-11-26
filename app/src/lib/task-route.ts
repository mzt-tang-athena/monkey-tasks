import { router } from "expo-router";

/**
 * Open a task the way its row does, from one encoded id segment. With
 * `picker`, the editor opens on that picker.
 */
export function openTask(id: string, options?: { picker?: "due" }): void {
  const path = `/task/${encodeURIComponent(id)}`;
  router.push(options?.picker == null ? path : `${path}?picker=${options.picker}`);
}
