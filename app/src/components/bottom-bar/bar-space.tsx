import * as React from "react";

type BarSpace = {
  /** The bar's height, its safe-area band included, in points. */
  height: number;
  /** Reports the bar's layout height. */
  report: (height: number) => void;
};

const BarSpaceContext = React.createContext<BarSpace | null>(null);

/**
 * Shares the bottom bar's height with a layer that sits above the
 * screen. The bar lives inside a screen, so a window-wide overlay
 * cannot read it in tree order. This provider holds the one number
 * both sides use.
 */
export function BarSpaceProvider({ children }: { children: React.ReactNode }) {
  const [height, setHeight] = React.useState(0);
  const report = React.useCallback((next: number) => {
    if (next > 0) {
      setHeight(next);
    }
  }, []);
  const value = React.useMemo(() => ({ height, report }), [height, report]);
  return (
    <BarSpaceContext.Provider value={value}>
      {children}
    </BarSpaceContext.Provider>
  );
}

/** The bar's published height, or null above no provider. */
export function useBarSpace(): BarSpace | null {
  return React.useContext(BarSpaceContext);
}
