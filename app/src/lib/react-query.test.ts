import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  AppState: {
    addEventListener: () => ({ remove: () => undefined }),
  },
}));

import { makeQueryClient } from "./react-query";

describe("makeQueryClient", () => {
  it("never pauses a vault read or write for the network", () => {
    const defaults = makeQueryClient().getDefaultOptions();
    expect(defaults.queries?.networkMode).toBe("always");
    expect(defaults.mutations?.networkMode).toBe("always");
  });

  it("drops a finished write unless it carries a notice", async () => {
    const client = makeQueryClient();
    const cache = client.getMutationCache();
    const run = (data: unknown) =>
      cache
        .build(client, { mutationFn: async () => data })
        .execute(undefined);

    await run({ done: true });
    expect(cache.getAll()).toHaveLength(0);

    await run({ notice: "both notes stay" });
    expect(cache.getAll()).toHaveLength(1);

    await expect(
      cache
        .build(client, {
          mutationFn: async () => {
            throw new Error("disk full");
          },
        })
        .execute(undefined),
    ).rejects.toThrow("disk full");
    expect(cache.getAll()).toHaveLength(2);
  });
});
