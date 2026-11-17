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

export const layoutAllowlist: LayoutAllow[] = [];
