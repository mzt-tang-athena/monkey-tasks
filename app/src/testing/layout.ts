// jsdom lays out nothing. A component test that needs a size or a
// position sets it here, where React Native Web reads it.
import { act } from "@testing-library/react";

/**
 * The window size `useWindowDimensions` reports. React Native Web
 * reads the root element's client size and updates on `resize`.
 */
export function setWindowSize(width: number, height: number): void {
  const root = document.documentElement;
  Object.defineProperty(root, "clientWidth", { configurable: true, value: width });
  Object.defineProperty(root, "clientHeight", { configurable: true, value: height });
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

/** The box `measureInWindow` reports for an element. */
export function placeBox(
  element: HTMLElement,
  box: { x: number; y: number; width: number; height: number },
): void {
  element.getBoundingClientRect = () =>
    ({
      left: box.x,
      top: box.y,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      right: box.x + box.width,
      bottom: box.y + box.height,
      toJSON: () => box,
    }) as DOMRect;
}
