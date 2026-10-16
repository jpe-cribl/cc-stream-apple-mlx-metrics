# cc-stream-apple-mlx-metrics

Normalizes Apple MLX serving and MacMon Prometheus metrics into native Cribl
metrics for Splunk-compatible routing.

## Pipeline

`mlx_metrics_normalize` accepts `sourcetype=mlx:metrics` events and Prometheus samples with `job=macmon`. MacMon's `__name__` becomes `_metric`,
and the event's `instance` supplies `host` when one is not already present. It
publishes `_metric`/`_value` events with every label as a dimension (for example
`chip` and `fan` on MacMon series) and top-level `node_*` fields as gauges with
`host` and `model` dimensions. `_value` is converted
to a number only for events that have `_metric`.

The `splunk_metrics_index` Pack variable sets the Splunk metrics index. Its default is `llm_metrics`.

## Integration

This pack contains processing logic. The consuming deployment routes events into the pipeline and binds the destination.

## Development

Use `bun run lint`, `bun run typecheck`, and `bun run test` for checks. Use `make build` to produce the `.crbl` artifact.
