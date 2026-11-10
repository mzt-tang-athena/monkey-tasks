import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The capture lands through the store, on the memory vault the web
// preview uses (ticket 0051). The create call holds, so the test sees
// the row while it still carries its provisional id.

vi.mock("@/lib/notifications", () => ({
  ensureNotificationPermission: async () => true,
  scheduleAt: async () => "alarm",
  cancelAllScheduled: async () => undefined,
  cancelScheduled: async () => undefined,
}));

import type { VaultAdapter } from "@/lib/vault/adapter";
import { Landing } from "@/components/motion/landing";
import { makeQueryClient } from "@/lib/react-query";
import { createMemoryVault } from "@/lib/vault/adapters/memory";
import { VaultProvider } from "@/lib/vault/vault-provider";
import { useCaptureTask } from "@/stores/tasks/mutations/use-capture-task";
import { useTaskList } from "@/stores/tasks/task-state";
import { TasksProvider } from "@/stores/tasks/tasks-provider";

function CaptureButton() {
  const run = useCaptureTask();
  return (
    <button onClick={() => void run({ name: "Buy stamps" }, { kind: "main" })}>
      capture
    </button>
  );
}

function Rows() {
  const tasks = useTaskList();
  return (
    <>
      {tasks.map((task) => (
        <Landing key={task.id} id={task.uri}>
          <span data-testid={`uri:${task.uri}`}>Buy stamps</span>
        </Landing>
      ))}
    </>
  );
}

function Bodies() {
  return (
    <>
      <CaptureButton />
      <Rows />
    </>
  );
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 4; turn += 1) {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 0);
      await promise;
    }
  });
}

const settle = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 300)));

/** The view that carries the entrance: the one around the row. */
function entranceOf(element: HTMLElement) {
  return element.parentElement as HTMLElement;
}

let releaseCreate: (() => void) | null = null;

async function mount(): Promise<VoidFunction> {
  const inner = createMemoryVault();
  const gate = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  const adapter: VaultAdapter = {
    ...inner,
    async create(folder, fileName, text) {
      await gate;
      return inner.create(folder, fileName, text);
    },
  };
  const client = makeQueryClient();
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({
    ...defaults,
    queries: { ...defaults.queries, retry: false, gcTime: Infinity },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <VaultProvider adapter={adapter}>
        <TasksProvider>
          <Bodies />
        </TasksProvider>
      </VaultProvider>
    </QueryClientProvider>,
  );
  await flush();
  return view.unmount;
}

beforeEach(() => {
  releaseCreate = null;
});

describe("the capture landing", () => {
  it("plays on the provisional id and not on the remount under the file uri", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "capture" }));
    await flush();

    const provisional = screen
      .getAllByTestId(/^uri:/)
      .map((node) => node.dataset.testid?.slice(4) ?? "")
      .find((uri) => uri.startsWith("pending://"));
    expect(provisional, "the row mounts under its provisional id").toBeTruthy();

    await waitFor(() =>
      expect(entranceOf(screen.getByTestId(`uri:${provisional}`)).style.animationName).not.toBe(""),
    );

    await act(async () => {
      releaseCreate?.();
      await Promise.resolve();
    });
    await flush();

    const fileUri = await waitFor(() => {
      const uri = screen
        .getAllByTestId(/^uri:/)
        .map((node) => node.dataset.testid?.slice(4) ?? "")
        .find((value) => value.startsWith("content://") || value.startsWith("memory://"));
      if (uri == null) {
        throw new Error("the row took no file uri");
      }
      return uri;
    });

    render(
      <Landing id={fileUri}>
        <span data-testid="remount">Buy stamps</span>
      </Landing>,
    );
    await settle();
    expect(entranceOf(screen.getByTestId("remount")).style.animationName).toBe("");
  });
});
