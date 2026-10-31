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
    dimensions: ["*"],
  });
  expect(
    publishers.find((fn) => fn.filter === "_metric === undefined")?.conf,
  ).toMatchObject({
    dimensions: ["host"],
    fields: [
      "node_load1",
      "node_load5",
      "node_load15",
      "node_memory_used_bytes",
      "node_memory_used_percent",
      "node_memory_swap_used_bytes",
      "node_cpu_percent_active_all",
    ].map((inFieldName) => ({ inFieldName, metricType: "gauge" })),
  });
});

it("aggregates per-process samples into native metrics by process set", () => {
  const pipeline = yamlParse(
    readFileSync(
      join(PACK_ROOT, "default", "pipelines", "process_agg", "conf.yml"),
      "utf8",
    ),
  ) as Pipeline;
  const aggregation = (pipeline.functions ?? []).find(
    (fn) => fn.id === "aggregation",
  );
  expect(aggregation?.conf).toMatchObject({
    metricsMode: true,
    groupbys: ["host", "process_set"],
    cumulative: false,
  });
  expect(aggregation?.conf?.aggregations).toEqual([
    "sum(process_resident_memory_bytes).as(process_resident_memory_bytes)",
    "sum(process_num_threads).as(process_num_threads)",
    "sum(process_cpu_usage).as(process_cpu_usage)",
  ]);
});
