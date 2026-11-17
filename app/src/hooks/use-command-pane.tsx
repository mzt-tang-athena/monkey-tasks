import * as React from "react";

/** What a header band reads to open the command pane. */
export type CommandPaneValue = {
  /** Opens the pane over the current screen. */
  show: () => void;
};

/**
 * The pane's opener, provided above every screen. The fallback keeps a
 * screen renderable on its own, as a unit test does. The app mounts one
 * provider above the stack, so the fallback never runs there.
 */
export const CommandPaneContext = React.createContext<CommandPaneValue>({
  show: () => {},
});

/** The pane's opener, for a header band's button and pull. */
export function useCommandPane(): CommandPaneValue {
  return React.useContext(CommandPaneContext);
}
