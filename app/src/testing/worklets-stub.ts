// Vitest stub for react-native-worklets in the node project, which
// cannot load the package. A worklet run in node is a plain call, so
// the crossing to JS is a plain call too.
export function scheduleOnRN<A extends unknown[]>(
  fn: (...args: A) => void,
  ...args: A
): void {
  fn(...args);
}
