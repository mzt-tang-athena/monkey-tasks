/**
 * The gallery's matrix: one section per primitive, one state per row,
 * in the order the page draws them. `gallery-screen.tsx` maps each
 * state id to a node, so a new state is a compile error until it has
 * one. The end-to-end spec walks these ids, so the page and its check
 * cannot drift apart.
 */

export type GalleryState = { id: string; label: string };

export type GallerySection = {
  id: string;
  title: string;
  states: readonly GalleryState[];
};

export const GALLERY_SECTIONS = [
  {
    id: "button",
    title: "Button",
    states: [
      { id: "button:primary", label: "primary" },
      { id: "button:secondary", label: "secondary" },
      { id: "button:text", label: "text" },
      { id: "button:disabled", label: "disabled" },
    ],
  },
  {
    id: "pressable",
    title: "Pressable",
    states: [
      { id: "pressable:rest", label: "rest" },
      { id: "pressable:pressed", label: "pressed" },
      { id: "pressable:focused", label: "focused" },
    ],
  },
  {
    id: "icon-button",
    title: "IconButton",
    states: [
      { id: "icon-button:rest", label: "rest" },
      { id: "icon-button:active", label: "active" },
      { id: "icon-button:focused", label: "focused" },
    ],
  },
  {
    id: "segmented-control",
    title: "SegmentedControl",
    states: [{ id: "segmented-control:selected", label: "selected" }],
  },
  {
    id: "tab-strip",
    title: "TabStrip",
    states: [{ id: "tab-strip:selected", label: "selected" }],
  },
  {
    id: "pill",
    title: "Pill",
    states: [
      { id: "pill:control", label: "control" },
      { id: "pill:chip", label: "chip" },
    ],
  },
  {
    id: "text-field",
    title: "TextField",
    states: [
      { id: "text-field:rest", label: "rest" },
      { id: "text-field:focused", label: "focused" },
      { id: "text-field:error", label: "error" },
    ],
  },
  {
    id: "banner",
    title: "Banner",
    states: [
      { id: "banner:danger", label: "danger" },
      { id: "banner:info", label: "info" },
    ],
  },
  {
    id: "list-states",
    title: "List states",
    states: [
      { id: "list-states:loading", label: "loading" },
      { id: "list-states:empty", label: "empty" },
      { id: "list-states:error", label: "error" },
    ],
  },
  {
    id: "section-header",
    title: "SectionHeader",
    states: [
      { id: "section-header:accent", label: "accent" },
      { id: "section-header:danger", label: "danger" },
      { id: "section-header:muted", label: "muted" },
      { id: "section-header:faint", label: "faint" },
    ],
  },
  {
    id: "card-group-row",
    title: "Card group row",
    states: [{ id: "card-group-row:group", label: "first, middle, last" }],
  },
  {
    id: "task-row",
    title: "Task row face",
    states: [
      { id: "task-row:rest", label: "rest" },
      { id: "task-row:done", label: "done" },
      { id: "task-row:selected", label: "selected" },
    ],
  },
  {
    id: "menu",
    title: "Menu",
    states: [{ id: "menu:open", label: "open" }],
  },
  {
    id: "sheet",
    title: "Sheet",
    states: [{ id: "sheet:open", label: "open" }],
  },
  {
    id: "command-pane",
    title: "Command pane",
    states: [{ id: "command-pane:open", label: "open" }],
  },
  {
    id: "toast",
    title: "Toast",
    states: [{ id: "toast:open", label: "open" }],
  },
  {
    id: "overlay-host",
    title: "Overlay host",
    states: [{ id: "overlay-host:mounts", label: "mounts" }],
  },
] as const satisfies readonly GallerySection[];

export type GallerySectionId = (typeof GALLERY_SECTIONS)[number]["id"];

export type GalleryStateId =
  (typeof GALLERY_SECTIONS)[number]["states"][number]["id"];

export const GALLERY_STATE_IDS: readonly GalleryStateId[] =
  GALLERY_SECTIONS.flatMap((section) =>
    section.states.map((state) => state.id),
  ) as readonly GalleryStateId[];

/** The cell's test id. One id serves the page, the spec and a screenshot. */
export function stateTestId(id: GalleryStateId): string {
  return `gallery-state:${id}`;
}
