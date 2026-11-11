import * as React from "react";
import type { Session, SessionHandlers } from "./session";

/** The nearest drag session. Sources, zones and scrollers join it. */
export const SessionContext = React.createContext<Session | null>(null);

/** Whether the nearest session has a drag picked up. */
export const DraggingContext = React.createContext(false);

/** The nearest scroller's id in its session, or -1. A zone clips to it. */
export const ClipContext = React.createContext(-1);

export function useSessionContext<H extends SessionHandlers = SessionHandlers>(
  name: string,
): Session & { handlers: H } {
  const session = React.useContext(SessionContext);
  if (session === null) {
    throw new Error(`${name} must render inside its surface's Root.`);
  }
  return session as Session & { handlers: H };
}
