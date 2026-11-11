import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";
import { type PropsWithChildren } from "react";
import { THEMES } from "@/theme/palettes";

/**
 * Root HTML for web. The paper background is set here so there is no
 * white flash while the bundle loads. The inline script then swaps in
 * the saved palette's paper before hydration, so a restart on midnight
 * does not flash the default cream.
 */

/** The paper for each palette, inlined for the pre-hydration script. */
const papers = JSON.stringify(
  Object.fromEntries(
    Object.entries(THEMES).map(([name, palette]) => [name, palette.paper]),
  ),
);

export default function Root({ children }: PropsWithChildren) {
  const { headNodes, bodyNodes, htmlAttributes, bodyAttributes } =
    useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `html, body { background-color: var(--paper, ${THEMES.budget.paper}); }
* { scrollbar-width: none; }
*::-webkit-scrollbar { display: none; }`,
          }}
        />
        {/* Before hydration, so the saved palette paints first. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try { var papers = ${papers}; var saved = localStorage.getItem("monkey-tasks.theme"); var bg = papers[saved] || papers.budget; document.documentElement.style.setProperty("--paper", bg); } catch (error) {}`,
          }}
        />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
