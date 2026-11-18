/**
 * `npm run app-icon:build`. Rasterizes the committed SVG sources in
 * `source/` into `assets/`, then writes the mask preview the ADR and
 * the PR show. Run it from `app`, because it uses Playwright's bundled
 * Chromium. Add `--no-preview` to skip the preview.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { ASSETS, atSize, readSource } from "./build.js";

const app = join(import.meta.dirname, "..", "..");
const assets = join(app, "assets");
const previewFile = join(app, "..", "docs", "assets", "app-icon-preview.png");

async function rasterize(page: Page, svg: string, size: number): Promise<Buffer> {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${atSize(svg, size)}`,
  );
  return page.screenshot({ omitBackground: true, type: "png" });
}

function dataUrl(png: Buffer): string {
  return `data:image/png;base64,${png.toString("base64")}`;
}

const MASK = {
  square: "",
  squircle: "border-radius:22.5%",
  circle: "border-radius:50%",
} as const;

/** One mask at every size the eye check asks for. */
function maskRow(name: keyof typeof MASK, png: Buffer): string {
  const sizes = [192, 128, 96, 72, 48, 30];
  return `<div class="row"><span class="tag">${name}</span>${sizes
    .map(
      (size) =>
        `<figure><img src="${dataUrl(png)}" style="width:${size}px;height:${size}px;${MASK[name]}"><figcaption>${size}</figcaption></figure>`,
    )
    .join("")}</div>`;
}

/**
 * The adaptive layers as Android draws them. A launcher shows the
 * middle 72 of the 108 unit layer, so the window crops the layer and
 * the background still fills the mask.
 */
function adaptive(
  visible: number,
  mask: keyof typeof MASK,
  foreground: Buffer,
  options: { background?: Buffer; tint?: string; filter?: string } = {},
): string {
  const layer = Math.round((visible * 108) / 72);
  const inset = (layer - visible) / 2;
  const filter = options.filter ? `;filter:${options.filter}` : "";
  const art = options.background
    ? `<img src="${dataUrl(options.background)}" class="layer">
       <img src="${dataUrl(foreground)}" class="layer" style="z-index:1${filter}">`
    : `<img src="${dataUrl(foreground)}" class="layer" style="${filter.replace(/^;/, "")}">`;
  const tint = options.tint ? `;background:${options.tint}` : "";
  return `<span class="window" style="width:${visible}px;height:${visible}px;${MASK[mask]}${tint}">
    <span class="layerbox" style="width:${layer}px;height:${layer}px;margin:${-inset}px 0 0 ${-inset}px">${art}</span>
  </span>`;
}

function preview(pngs: Map<string, Buffer>): string {
  const fg = pngs.get("android-icon-foreground.png")!;
  const bg = pngs.get("android-icon-background.png")!;
  const mono = pngs.get("android-icon-monochrome.png")!;
  const tile = pngs.get("icon.png")!;
  const splash = pngs.get("splash-icon.png")!;
  const favicon = pngs.get("favicon.png")!;
  return `<!doctype html><html><head><style>
    body{margin:0;padding:24px;background:#FFFFFF;color:#1B1B1B;
      font:13px/1.4 system-ui,sans-serif}
    h2{font-size:13px;font-weight:600;margin:0 0 12px;color:#5A5A5A}
    section{margin-bottom:22px}
    .row{display:flex;align-items:flex-end;gap:28px;margin-bottom:14px}
    .tag{width:64px;font-size:12px;color:#6A6A6A;align-self:center}
    figure{margin:0;text-align:center}
    figcaption{font-size:11px;color:#7A7A7A;margin-top:4px}
    img{display:block}
    .window{display:inline-block;position:relative;overflow:hidden;flex:none}
    .layerbox{position:relative;display:block}
    .layer{position:absolute;inset:0;width:100%;height:100%}
    .shelf{display:flex;align-items:center;gap:24px;background:#5D6B63;
      padding:16px 20px;border-radius:10px}
    .shelf.light{background:#E9E6DC}
  </style></head><body>
    <section><h2>Icon, masks</h2>
      ${maskRow("square", tile)}
      ${maskRow("squircle", tile)}
      ${maskRow("circle", tile)}
    </section>
    <section><h2>Adaptive icon, Pixel circle mask</h2>
      <div class="row">
        ${adaptive(192, "circle", fg, { background: bg })}
        ${adaptive(96, "circle", fg, { background: bg })}
        ${adaptive(48, "circle", fg, { background: bg })}
      </div>
    </section>
    <section><h2>On a launcher, 48 to 96</h2>
      <div class="shelf">${adaptive(96, "squircle", fg, { background: bg })}${adaptive(72, "circle", fg, { background: bg })}${adaptive(48, "squircle", fg, { background: bg })}</div>
      <div class="shelf light" style="margin-top:8px">${adaptive(96, "circle", fg, { background: bg })}${adaptive(72, "squircle", fg, { background: bg })}${adaptive(48, "circle", fg, { background: bg })}</div>
    </section>
    <section><h2>Monochrome, themed icons</h2>
      <div class="shelf" style="gap:32px">
        ${adaptive(96, "circle", mono, { tint: "#D7E2BE", filter: "brightness(0)" })}
        ${adaptive(72, "squircle", mono, { tint: "#3E4A2E", filter: "brightness(0) invert(1)" })}
      </div>
    </section>
    <section><h2>Splash image and favicon</h2>
      <div class="shelf light" style="gap:32px">
        <img src="${dataUrl(splash)}" style="width:96px;height:96px">
        <img src="${dataUrl(favicon)}" style="width:48px;height:48px">
        <img src="${dataUrl(favicon)}" style="width:32px;height:32px">
        <img src="${dataUrl(favicon)}" style="width:16px;height:16px">
      </div>
    </section>
  </body></html>`;
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
  try {
    const page = await browser.newPage({
      viewport: { width: 1024, height: 1024 },
      deviceScaleFactor: 1,
    });
    const pngs = new Map<string, Buffer>();

    for (const asset of ASSETS) {
      const png = await rasterize(page, readSource(asset.source), asset.size);
      writeFileSync(join(assets, asset.file), png);
      pngs.set(asset.file, png);
      console.log(`${asset.file} ${asset.size} <- ${asset.source}`);
    }

    if (!process.argv.includes("--no-preview")) {
      const html = preview(pngs);
      await page.setViewportSize({ width: 900, height: 1050 });
      await page.setContent(html);
      const shot = await page.screenshot({ fullPage: true, type: "png" });
      mkdirSync(join(app, "..", "docs", "assets"), { recursive: true });
      writeFileSync(previewFile, shot);
      console.log(`wrote ${previewFile}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
