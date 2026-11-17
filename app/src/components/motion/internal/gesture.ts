/**
 * Puts `touchAction` in a gesture config. Gesture handler 3.3.0 wipes
 * the detector's `touchAction` prop on the web, and its public config
 * types omit the field (ADR 0046). No other file names it. The config
 * comes in as one object literal, because the worklets plugin rejects
 * a spread inside a gesture config.
 */
export function withTouchAction<C extends object>(
  touchAction: "pan-x" | "pan-y" | "none",
  config: C,
): C {
  return Object.assign(config, { touchAction });
}
