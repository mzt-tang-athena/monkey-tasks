import * as React from "react";
import { Menu, type MenuItem } from "@/components/ui/menu";
import {
  SOURCES,
  sourceLabel,
  type Mode,
  type Source,
} from "@/features/planner/model";
import type { MenuAnchor } from "@/features/planner/hooks/use-planner-source";

/** Stands in for the anchor while the chooser is closed. */
const noAnchor: MenuAnchor = { current: null };

/**
 * The source chooser: the due period for the period on screen, then
 * each named list. It opens from the toggle that was held. The `Menu`
 * draws it through the overlay host, above the bottom bar, and flips or
 * clamps it to stay on screen.
 */
export function SourceMenu({
  anchor,
  source,
  mode,
  day,
  today,
  onChoose,
  onClose,
}: {
  /** The toggle the chooser opens from, or null when it is closed. */
  anchor: MenuAnchor | null;
  source: Source;
  mode: Mode;
  day: Date;
  today: Date;
  onChoose: (source: Source) => void;
  onClose: () => void;
}) {
  const items = React.useMemo<MenuItem[]>(
    () =>
      SOURCES.map((option) => ({
        key: option,
        label: sourceLabel(option, mode, day, today),
        selected: option === source,
        onPress: () => onChoose(option),
      })),
    [source, mode, day, today, onChoose],
  );
  return (
    <Menu
      open={anchor != null}
      anchor={anchor ?? noAnchor}
      onClose={onClose}
      label="task source"
      items={items}
      align="start"
    />
  );
}
