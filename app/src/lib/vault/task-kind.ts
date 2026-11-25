import { nowStamp } from "@/utils/dates";
import { updateProperty } from "./frontmatter";

/**
 * The text a note from `Deeds/` takes on its next app write
 * (ADR `20261124-deeds-are-tasks-with-a-status`): the task kind, and a
 * `created` date when the deed has none, because a task note needs one.
 * The write is surgical, so `parent deed`, `categories`, `types`,
 * `after` and every other property stay as they are. A note already in
 * the task shape comes back byte-identical, where its `kind` line is in
 * the quoted form the writer emits.
 *
 * `created` is the stamp it added, so a caller that keeps the row in
 * memory can move its data with the text. It is null when the note
 * already had one.
 */
export function takeTaskShape(
  text: string,
  hasCreated: boolean,
): { text: string; created: string | null } {
  const shaped = updateProperty(text, "kind", "[[tasks]]");
  if (hasCreated) {
    return { text: shaped, created: null };
  }
  const created = nowStamp();
  return { text: updateProperty(shaped, "created", created), created };
}
