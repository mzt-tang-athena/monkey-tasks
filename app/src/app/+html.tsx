import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";
import { type PropsWithChildren } from "react";
import { colors } from "@/theme/tokens";

/**
 * Root HTML for web. The paper background is set here so there is no
 * white flash while the bundle loads. The browser focus ring is
 * themed to the accent instead of the default black.
 */
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
            __html: `html, body { background-color: ${colors.paper}; }
* { scrollbar-width: none; }
*::-webkit-scrollbar { display: none; }`,
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
