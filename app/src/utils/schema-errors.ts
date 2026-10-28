/** The shape a zod issue has that the app cares about. */
type Issue = {
  readonly path: readonly PropertyKey[];
  readonly message: string;
};

/**
 * Render a validation issue as one line: "path: message". A root
 * issue, with no path, reads "note: message".
 */
export function formatIssues(issues: readonly Issue[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.map(String).join(".") || "note";
    return `${path}: ${issue.message}`;
  });
}
