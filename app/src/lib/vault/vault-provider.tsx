import * as React from "react";
import type { VaultAdapter } from "./adapter";
import { defaultAdapter } from "./default-adapter";

/**
 * Which vault the app talks to, and the root the user granted in it
 * (ADR 0037). Android gets the SAF adapter, the web gets the memory
 * adapter. A test passes its own.
 */
export type Vault = {
  adapter: VaultAdapter;
  /** The granted root, or null when there is none. */
  root: string | null;
  /** False until the saved root has been read. */
  booted: boolean;
  /** Ask for a root. Resolves with it, or with null on a cancel. */
  grant(): Promise<string | null>;
};

const VaultContext = React.createContext<Vault | null>(null);

export function VaultProvider({
  adapter,
  children,
}: {
  /** Read once, on mount. */
  adapter?: VaultAdapter;
  children: React.ReactNode;
}) {
  const [vault] = React.useState(() => adapter ?? defaultAdapter());
  const [root, setRoot] = React.useState<string | null>(null);
  const [booted, setBooted] = React.useState(false);

  // Boot once: read the saved root. The store's queries follow it, and
  // a fresh grant moves it.
  React.useEffect(() => {
    let live = true;
    void (async () => {
      let saved: string | null = null;
      try {
        saved = await vault.savedRoot();
      } catch {
        saved = null;
      }
      if (live) {
        setRoot(saved);
        setBooted(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [vault]);

  const grant = React.useCallback(async () => {
    let uri: string | null = null;
    try {
      uri = await vault.requestRoot();
    } catch {
      uri = null;
    }
    if (uri != null) {
      setRoot(uri);
    }
    return uri;
  }, [vault]);

  const value = React.useMemo<Vault>(
    () => ({ adapter: vault, root, booted, grant }),
    [vault, root, booted, grant],
  );
  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  );
}

export function useVault(): Vault {
  const vault = React.useContext(VaultContext);
  if (vault == null) {
    throw new Error("useVault must run inside VaultProvider");
  }
  return vault;
}
