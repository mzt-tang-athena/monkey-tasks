// Turns reduce motion on for one component test file. Reanimated reads
// the flag once, when it loads, so import this before anything that
// imports Reanimated. Its layout animations then show at once, which
// jsdom needs: it never runs the CSS animation that would reveal them.
window.matchMedia = (query: string) =>
  ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }) as unknown as MediaQueryList;
