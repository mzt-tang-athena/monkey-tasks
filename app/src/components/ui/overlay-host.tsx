import * as React from "react";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";
import { layers, type Layer } from "@/theme/tokens";

type Entry = {
  id: number;
  layer: Layer;
  modal: boolean;
  node: React.ReactNode;
};

type Host = {
  set: (entry: Entry) => void;
  remove: (id: number) => void;
};

const HostContext = React.createContext<Host | null>(null);

let nextId = 1;

/**
 * Hides the screen from assistive tech while a modal overlay shows:
 * `aria-hidden` on the web, `no-hide-descendants` on Android, and
 * the element flag on iOS.
 */
const hidden: ViewProps = Platform.select<ViewProps>({
  web: { "aria-hidden": true },
  android: { importantForAccessibility: "no-hide-descendants" },
  default: { accessibilityElementsHidden: true },
});

/**
 * The root portal. It wraps the app's stack in `src/app/_layout.tsx`
 * and draws every `Overlay` above every screen, at its `layers` value.
 * An overlay renders here, outside the screen that opened it, so it
 * sees the app's providers and not the screen's own.
 */
export function OverlayHost({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const host = React.useMemo<Host>(
    () => ({
      set: (entry) =>
        setEntries((list) => {
          const index = list.findIndex((item) => item.id === entry.id);
          if (index === -1) {
            return [...list, entry];
          }
          const next = list.slice();
          next[index] = entry;
          return next;
        }),
      remove: (id) => setEntries((list) => list.filter((item) => item.id !== id)),
    }),
    [],
  );
  const modal = entries.some((entry) => entry.modal);
  // The layer orders the overlays. Within one layer, the newest draws
  // on top.
  const sorted = entries
    .slice()
    .sort((a, b) => layers[a.layer] - layers[b.layer] || a.id - b.id);

  return (
    <HostContext.Provider value={host}>
      <View style={styles.fill}>
        <View style={styles.fill} {...(modal ? hidden : null)}>
          {children}
        </View>
        {sorted.map((entry) => (
          <LayerView key={entry.id} layer={entry.layer}>
            {entry.node}
          </LayerView>
        ))}
      </View>
    </HostContext.Provider>
  );
}

/**
 * Draws its children in the `OverlayHost`, above every screen, at the
 * given layer. A `modal` overlay hides the screen from assistive tech
 * while it shows. The children position themselves inside a layer
 * that fills the window and lets touches through where it is empty.
 *
 * Without a host above it, the overlay draws in place at its layer.
 */
export function Overlay({
  layer,
  modal = false,
  children,
}: {
  layer: Layer;
  modal?: boolean;
  children: React.ReactNode;
}) {
  const host = React.useContext(HostContext);
  const [id] = React.useState(() => nextId++);
  // Every render hands the host the current children, before paint,
  // so the overlay never shows a frame behind the screen.
  React.useLayoutEffect(() => {
    host?.set({ id, layer, modal, node: children });
  });
  React.useLayoutEffect(() => {
    if (host == null) {
      return;
    }
    return () => host.remove(id);
  }, [host, id]);

  if (host != null) {
    return null;
  }
  return <LayerView layer={layer}>{children}</LayerView>;
}

/** One layer: fills the window and passes touches through its gaps.
    Android orders siblings by elevation before z index, so the layer
    sets both to the same value. */
function LayerView({
  layer,
  children,
}: {
  layer: Layer;
  children: React.ReactNode;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={[
        StyleSheet.absoluteFill,
        { zIndex: layers[layer], elevation: layers[layer] },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
