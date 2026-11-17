/**
 * react-native-svg's web build reads a registered asset for a numeric
 * `source`. The app passes only path data, and the asset registry ships
 * with React Native's native build, so the jsdom project stubs it.
 */
export function getAssetByID(): null {
  return null;
}
