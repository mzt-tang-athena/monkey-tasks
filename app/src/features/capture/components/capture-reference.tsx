import * as React from "react";
import { ReferencePicker } from "@/components/references/reference-picker";
import { useReferenceNotes } from "@/stores/references/use-references";

/**
 * The capture sheet's reference picker. It mounts only while it shows,
 * so the References folder is read when a link is asked for, not every
 * time the capture sheet opens.
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
