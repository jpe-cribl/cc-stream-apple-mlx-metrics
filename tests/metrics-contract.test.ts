import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { parse as yamlParse } from "yaml";
import { PACK_ROOT } from "./cribl-client.js";

interface Pipeline {
  functions?: {
    id: string;
    filter?: string;
    conf?: Record<string, unknown>;
  }[];
}

it("publishes both supported Apple MLX metric shapes", () => {
  const pipeline = yamlParse(
    readFileSync(
      join(
        PACK_ROOT,
        "default",
        "pipelines",
        "mlx_metrics_normalize",
        "conf.yml",
      ),
      "utf8",
    ),
  ) as Pipeline;
  const publishers = (pipeline.functions ?? []).filter(
    (fn) => fn.id === "publish_metrics",
  );

  expect(publishers).toHaveLength(2);
  expect(
    publishers.find((fn) => fn.filter === "_metric !== undefined")?.conf,
  ).toMatchObject({
    metricNameField: "_metric",
    valueField: "_value",
    dimensions: ["host", "model"],
  });
  expect(
    publishers.find((fn) => fn.filter === "_metric === undefined")?.conf,
  ).toMatchObject({
    dimensions: ["host", "model"],
    fields: [{ inFieldName: "node_*", metricType: "gauge" }],
  });
});
