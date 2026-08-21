# Observability

Metrics, health checks, and structured logging for the Weight Loss platform.

## Health endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness — API process is running |
| `GET /ready` | Readiness — MongoDB + Redis reachable |

Use `/health` for load balancer pings and `/ready` for deploy gates.

## Prometheus metrics

When `METRICS_ENABLED=true` (default in development):

```
GET /metrics
```

Returns Prometheus text format 0.0.4.

### Authentication

| Environment | Configuration |
|-------------|---------------|
| Development | `METRICS_TOKEN` empty — open scrape |
| Production | `METRICS_TOKEN` required — pass `Authorization: Bearer <token>` |

Production startup fails if `METRICS_ENABLED=true` without `METRICS_TOKEN`.

### Exposed metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `weightloss_http_requests_total` | counter | method, route, status | HTTP requests |
| `weightloss_http_request_duration_ms` | histogram | method, route | Request latency (ms) |
| `weightloss_cache_requests_total` | counter | resource, result | Cache hit/miss (`hit` / `miss`) |
| `weightloss_queue_jobs` | gauge | queue, state | BullMQ job counts |

Queue label `queue`: `import`, `export`, `raw`  
State labels: `waiting`, `active`, `completed`, `failed`, `delayed`, `paused`

`/metrics`, `/health`, and `/ready` are excluded from rate limiting.

### Example scrape config (Prometheus)

```yaml
scrape_configs:
  - job_name: weightloss-api
    metrics_path: /metrics
    bearer_token: YOUR_METRICS_TOKEN
    static_configs:
      - targets: ["api.internal:5000"]
```

### Example query (Grafana)

```promql
rate(weightloss_http_requests_total{status=~"5.."}[5m])
histogram_quantile(0.95, rate(weightloss_http_request_duration_ms_bucket[5m]))
sum by (resource, result) (rate(weightloss_cache_requests_total[5m]))
```

## Structured logging

Services use `@weightloss/logger` (Pino):

| Service | Logger name |
|---------|-------------|
| API | `weightloss-api` |
| Worker | `weightloss-worker` |

Notable log events:

- `slow_request` — duration exceeds `SLOW_REQUEST_MS`
- `job_completed` / `job_failed` — worker job lifecycle
- `mongo_connected`, `api_started`, `worker_started`

Secrets are redacted automatically (passwords, tokens, connection URIs).

Set `LOG_LEVEL=info` in production (`debug` only for troubleshooting).

## Worker visibility

The worker does not expose HTTP. Job progress is tracked via:

1. **Logs** — `job_completed`, `job_failed`
2. **Metrics** — queue gauges on API `/metrics` scrape
3. **Admin UI** — `/data/jobs` job history

## Environment variables

```env
METRICS_ENABLED=true
METRICS_PATH=/metrics
METRICS_TOKEN=

SLOW_REQUEST_MS=300
LOG_LEVEL=info
```

See [`ENVIRONMENT.md`](ENVIRONMENT.md) for the full list.

## Related

- [`DEPLOYMENT.md`](DEPLOYMENT.md) — production setup
- [`PUBLIC-API.md`](PUBLIC-API.md) — client-facing API
