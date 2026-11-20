import { spawn, spawnSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "../fixtures";

/**
 * Ticket 20261120-e2e-survives-a-network-change. A container network
 * that comes or goes changes an address on the host, and Chromium takes
 * it for a network change. It then aborts the loads in flight with
 * net::ERR_NETWORK_CHANGED, even for localhost, and a page that lost
 * the request it boots from stays blank.
 *
 * The page here boots from a fetch. Twenty fetches fill the origin's
 * sockets, so the boot request waits in the pool, which is where the
 * abort finds it. The fetches answer after `holdMs`, so the reload that
 * follows the abort finds a socket.
 *
 * A plain `docker run` removes only the veth's IPv6 link-local address,
 * which Chromium 156 does not report as a network change. Removing a
 * container network takes an IPv4 address off a bridge, which it does.
 */
const holds = 20;
const holdMs = 1500;
/** A port nothing listens on, so a fetch there is refused at once. */
const refusedPort = 1;

const pageHtml = `<!doctype html>
<html><head><meta charset="utf-8" /><title>network change</title></head>
<body>
<div id="root"></div>
<script>
  const refuse = location.search === "?refuse=1";
  window.boot = () =>
    fetch(refuse ? "/boot-src" : "/boot.js")
      .then((response) => response.text())
      .then((text) =>
        refuse ? fetch(text).then((response) => response.text()) : text,
      )
      .then((code) => (0, eval)(code))
      .catch(() => {});
  if (localStorage.getItem("busy") == null) {
    localStorage.setItem("busy", "1");
    for (let i = 0; i < ${holds}; i++) fetch("/hold?" + i).catch(() => {});
    window.boot();
  } else {
    window.boot();
  }
</script>
</body></html>`;

const boot = `document.getElementById("root").textContent = "booted";`;

let server: Server;
let origin: string;
let bootSources = 0;
let network = "";

test.beforeAll(async () => {
  // The network exists before the page loads, so the browser has the
  // bridge address, and removing it is a change the browser reports.
  network = `e2e-network-change-${process.pid}`;
  await docker("network", "create", network);
  server = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://localhost");
    if (pathname === "/hold") {
      setTimeout(() => response.end(), holdMs);
      return;
    }
    if (pathname === "/boot-src") {
      // The first load gets a dead address, a reload a live one.
      bootSources += 1;
      response.end(
        bootSources === 1
          ? `http://127.0.0.1:${refusedPort}/boot.js`
          : "/boot.js",
      );
      return;
    }
    if (pathname === "/boot.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(boot);
      return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end(pageHtml);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

test.afterAll(async () => {
  await docker("network", "rm", network);
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function docker(...args: string[]): Promise<void> {
  // Asynchronous on purpose: the server in this file shares the event
  // loop, and a blocked loop cannot answer the page while it reloads.
  return new Promise((resolve) => {
    spawn("docker", args, { stdio: "ignore" }).on("exit", () => resolve());
  });
}

function hasDocker(): boolean {
  return spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
}

test("a network change during the load does not blank the page", async ({
  page,
}) => {
  test.skip(!hasDocker(), "needs a docker daemon");
  await page.goto(origin);
  // The pool has the boot request by now, so the abort will find it.
  await new Promise((resolve) => setTimeout(resolve, 300));
  await docker("network", "rm", network);
  await expect(page.getByText("booted")).toBeVisible();
});

test("another load error still fails the test", async ({ page }) => {
  // The page comes back only from net::ERR_NETWORK_CHANGED. This boot
  // fetch is refused, so the page must stay blank. A reload would fetch
  // the live address and boot, which shows here as an unexpected pass.
  test.fail();
  await page.goto(`${origin}?refuse=1`);
  await expect(page.getByText("booted")).toBeVisible({ timeout: 1000 });
});
