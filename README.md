# cc-stream-apple-mlx-metrics

Normalizes Apple MLX metrics into native Cribl metrics for Splunk-compatible routing.

## Pipeline

`mlx_metrics_normalize` drops events whose `sourcetype` is not `mlx:metrics`. It publishes `_metric`/`_value` events and top-level `node_*` fields as gauges, with `host` and `model` dimensions. `_value` is converted to a number only for events that have `_metric`.

The `splunk_metrics_index` Pack variable sets the Splunk metrics index. Its default is `llm_metrics`.

## Integration

This pack contains processing logic. The consuming deployment routes events into the pipeline and binds the destination.

## Development

Use `bun run lint`, `bun run typecheck`, and `bun run test` for checks. Use `make build` to produce the `.crbl` artifact.
