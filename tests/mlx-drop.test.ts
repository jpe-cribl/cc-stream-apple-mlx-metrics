import { expect, it } from "vitest";
import { getInstalledPackId, makeClient } from "./test-helpers.js";

it("drops events with a non-MLX sourcetype", async () => {
  const client = makeClient();
  const sampleId = await client.saveSample("non-mlx-metrics", [
    {
      sourcetype: "other:metrics",
      host: "example",
      source: "metrics",
      _time: 1781280000,
      _metric: "other.metric",
      _value: "1",
    },
  ]);

  try {
    const preview = await client.call("post", "/preview", {
      pack: getInstalledPackId(),
      payload: {
        mode: "pipe",
        pipelineId: "mlx_metrics_normalize",
        level: 3,
        sampleId,
        dropped: false,
        cpuProfile: false,
        timeout: 10_000,
        memory: 2048,
      },
    });
    const events =
      preview !== null &&
      typeof preview === "object" &&
      "items" in preview &&
      Array.isArray((preview as { items: unknown }).items)
        ? (preview as { items: unknown[] }).items
        : Array.isArray(preview)
          ? preview
          : [];
    expect(events).toHaveLength(0);
  } finally {
    await client.deleteSample(sampleId);
  }
});
