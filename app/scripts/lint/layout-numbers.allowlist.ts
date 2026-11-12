/**
 * Raw layout values the guard accepts. Every entry needs a reason that
 * says why the value is a mark, not a layout step.
 */
export type LayoutAllow = {
  file: string;
  property: string;
  value: number;
  reason: string;
};

export const layoutAllowlist: LayoutAllow[] = [
  {
    file: "src/components/ui/icon.tsx",
    property: "gap",
    value: 4,
    reason:
      "The list and grip glyphs space their strokes by 4. A glyph is drawn, so the layout scale must not move its parts.",
  },
  {
    file: "src/components/ui/icon.tsx",
    property: "borderRadius",
    value: 5,
    reason:
      "The calendar glyph's 20pt frame carries a 5pt curve. It is a drawn shape, not a panel corner.",
  },
];
