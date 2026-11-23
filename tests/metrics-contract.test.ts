import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
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

  expect(publishers).toHaveLength(3);
  expect(
    publishers.find(
      (fn) =>
        fn.filter === "_metric !== undefined && process_set === undefined",
    )?.conf,
  ).toMatchObject({
    metricNameField: "_metric",
    valueField: "_value",
    dimensions: ["*"],
  });
  // Process samples repeat their numeric process_* fields on every event, so
  // only these identifying fields may be dimensions.
  expect(
    publishers.find(
      (fn) =>
        fn.filter === "_metric !== undefined && process_set !== undefined",
    )?.conf,
  ).toMatchObject({
    metricNameField: "_metric",
    valueField: "_value",
    dimensions: [
      "host",
      "model",
      "process_set",
      "process_pid",
      "process_cmdline",
      "process_exe_path",
      "telemetry_role",
    ],
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

// Applies the normaliser's process-path eval functions to one event, in
// pipeline order, the way Cribl does: each runs only when its filter passes.
function applyProcessEvals(
  fields: Record<string, unknown>,
): Record<string, unknown> {
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
  const event: Record<string, unknown> = {
    // Cribl reads an absent field as undefined, so declare every field first.
    _metric: undefined,
    process_set: undefined,
    process_cmdline: undefined,
    ...fields,
  };
  for (const fn of pipeline.functions ?? []) {
    if (fn.id !== "eval" || !fn.filter?.includes("process_set")) continue;
    const passes = new Function(
      ...Object.keys(event),
      `return (${fn.filter});`,
    )(...Object.values(event));
    if (!passes) continue;
    const add = (fn.conf?.add ?? []) as { name: string; value: string }[];
    for (const { name, value } of add) {
      event[name] = runInNewContext(value, { ...event });
    }
  }
  return event;
}

it("names process metrics by process and labels the model from --model", () => {
  const hfCmd =
    "python -m mlx_lm.server --model /home/example/.cache/huggingface/hub/models--mlx-community--Qwen3-8B-4bit/snapshots/0123abcd --port 8080";

  const python = applyProcessEvals({
    _metric: "python_process_phys_footprint_bytes",
    process_set: "python",
    process_cmdline: hfCmd,
  });
  expect(python._metric).toBe("process_phys_footprint_bytes");
  expect(python.model).toBe("mlx-community/Qwen3-8B-4bit");

  const plain = applyProcessEvals({
    _metric: "python_process_resident_memory_bytes",
    process_set: "python",
    process_cmdline:
      "python -m mlx_lm.server --model mlx-community/Qwen3-8B-4bit --port 8080",
  });
  expect(plain._metric).toBe("process_resident_memory_bytes");
  expect(plain.model).toBe("mlx-community/Qwen3-8B-4bit");

  const noModel = applyProcessEvals({
    _metric: "python_process_cpu_usage",
    process_set: "python",
    process_cmdline: "python -m worker --port 8081",
  });
  expect(noModel.model).toBe("unknown");

  const multi = applyProcessEvals({
    _metric: "python_process_cpu_usage",
    process_set: "python",
    process_cmdline: [
      "python -m a --model org1/m1",
      "python -m b --model org2/m2",
    ],
  });
  expect(multi.model).toBe("org1/m1");
});

it("keeps judge per-process samples under their judge_process names", () => {
  const judge = applyProcessEvals({
    _metric: "judge_process_phys_footprint_bytes",
    process_set: "judge",
    process_cmdline: "python -m judge --port 8081",
  });
  // process_agg owns the judge group, so its per-process samples keep names.
  expect(judge._metric).toBe("judge_process_phys_footprint_bytes");
  expect(judge.model).toBe("unknown");
});

it("keeps judge process start-time samples on the process_agg route", () => {
  const routes = (
    yamlParse(
      readFileSync(
        join(PACK_ROOT, "default", "pipelines", "route.yml"),
        "utf8",
      ),
    ) as { routes: { pipeline: string; filter: string }[] }
  ).routes;
  const processAgg = routes.findIndex((r) => r.pipeline === "process_agg");
  const normalizer = routes.findIndex(
    (r) => r.pipeline === "mlx_metrics_normalize",
  );
  expect(processAgg).toBeGreaterThanOrEqual(0);
  expect(processAgg).toBeLessThan(normalizer);
  const filter = routes[processAgg]?.filter ?? "";
  const matches = (metric: string) =>
    new Function("_metric", `return (${filter});`)(metric);
  expect(matches("judge_process_start_time_seconds")).toBe(true);
  expect(matches("judge_process_phys_footprint_bytes")).toBe(false);
});
