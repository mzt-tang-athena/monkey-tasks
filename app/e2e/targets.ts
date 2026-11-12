import type { Page } from "@playwright/test";

/**
 * Every role the app gives a press, a field or a keyboard step. A
 * target counts only when it takes a real box on screen: a hidden copy
 * or an unmounted surface is skipped.
 */
const widgetRoles = [
  "button",
  "tab",
  "checkbox",
  "radio",
  "option",
  "gridcell",
  "menuitem",
  "menuitemradio",
  "link",
  "switch",
  "slider",
  "textbox",
  "searchbox",
];

/** WCAG 2.2 asks for 24; the app's own floor is 44. */
const minTarget = 44;
/** Layout boxes land on fractions of a pixel; a hair under is a pass. */
const slack = 0.5;

export type SmallTarget = {
  role: string;
  name: string;
  width: number;
  height: number;
};

/**
 * Every visible widget smaller than 44 by 44, from its layout box.
 * `root` is a CSS selector: the whole page by default, or one surface
 * such as an open dialog.
 *
 * A surface that plays an entrance grows from a smaller scale, so its
 * rows take less room on screen while it plays. The floor is about the
 * box a widget lays out, so the scale comes out of the answer.
 */
export async function smallTargets(
  page: Page,
  root = "body",
): Promise<SmallTarget[]> {
  return page.evaluate(
    ({ roles, min, slack, selector }) => {
      const scaleOf = (element: Element) => {
        let scale = 1;
        for (
          let node: Element | null = element;
          node != null;
          node = node.parentElement
        ) {
          const transform = getComputedStyle(node).transform;
          if (transform !== "none") {
            const matrix = new DOMMatrixReadOnly(transform);
            scale *= Math.hypot(matrix.a, matrix.b);
          }
        }
        return scale;
      };
      const scope = document.querySelector(selector) ?? document.body;
      const small: SmallTarget[] = [];
      for (const role of roles) {
        for (const element of scope.querySelectorAll(`[role="${role}"]`)) {
          const box = element.getBoundingClientRect();
          const scale = scaleOf(element);
          const width = box.width / scale;
          const height = box.height / scale;
          const style = getComputedStyle(element);
          if (
            width === 0 ||
            height === 0 ||
            style.visibility === "hidden" ||
            style.display === "none"
          ) {
            continue;
          }
          if (width < min - slack || height < min - slack) {
            small.push({
              role,
              name:
                element.getAttribute("aria-label") ??
                (element.textContent ?? "").trim().slice(0, 40),
              width: Math.round(width * 10) / 10,
              height: Math.round(height * 10) / 10,
            });
          }
        }
      }
      return small;
    },
    { roles: widgetRoles, min: minTarget, slack, selector: root },
  );
}
