import * as React from "react";
import { ReferencePicker } from "@/components/references/reference-picker";
import { useReferenceNotes } from "@/stores/references/use-references";

/**
 * The capture sheet's reference picker. It mounts with the sheet, so
 * the References folder reads once when the sheet opens and stays
 * cached for the picker and the editor that follows.
 */
export function CaptureReference({
  open,
  attached,
  onAttach,
  onClose,
}: {
  open: boolean;
  attached: string[];
  onAttach: (name: string) => void;
  onClose: () => void;
}) {
  const references = useReferenceNotes();
  return (
    <ReferencePicker
      open={open}
      onClose={onClose}
      notes={references.notes}
      attached={attached}
      onAttach={onAttach}
      error={references.error}
    />
  );
}
