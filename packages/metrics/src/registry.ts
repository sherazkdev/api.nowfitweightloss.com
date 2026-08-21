type LabelValues = Record<string, string>;

function labelKey(labelNames: string[], labels: LabelValues): string {
  return labelNames.map((name) => `${name}=${labels[name] ?? ""}`).join("|");
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

function formatLabels(labels: LabelValues): string {
  const parts = Object.entries(labels).map(
    ([key, value]) => `${key}="${escapeLabelValue(value)}"`,
  );
  return parts.length > 0 ? `{${parts.join(",")}}` : "";
}

export class Counter {
  private readonly values = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly labelNames: string[] = [],
  ) {}

  inc(labels: LabelValues = {}, amount = 1): void {
    const key = labelKey(this.labelNames, pickLabels(this.labelNames, labels));
    this.values.set(key, (this.values.get(key) ?? 0) + amount);
  }

  render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    for (const [key, value] of this.values.entries()) {
      lines.push(`${this.name}${formatLabelsFromKey(this.labelNames, key)} ${value}`);
    }
    return lines.join("\n");
  }
}

export class Gauge {
  private readonly values = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly labelNames: string[] = [],
  ) {}

  set(labels: LabelValues, value: number): void {
    const key = labelKey(this.labelNames, pickLabels(this.labelNames, labels));
    this.values.set(key, value);
  }

  render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
    ];
    for (const [key, value] of this.values.entries()) {
      lines.push(`${this.name}${formatLabelsFromKey(this.labelNames, key)} ${value}`);
    }
    return lines.join("\n");
  }
}

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export class Histogram {
  private readonly sums = new Map<string, number>();
  private readonly counts = new Map<string, number>();
  private readonly bucketCounts = new Map<string, Map<number, number>>();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly labelNames: string[] = [],
    readonly buckets: number[] = DEFAULT_BUCKETS,
  ) {}

  observe(labels: LabelValues, valueMs: number): void {
    const picked = pickLabels(this.labelNames, labels);
    const key = labelKey(this.labelNames, picked);
    this.sums.set(key, (this.sums.get(key) ?? 0) + valueMs);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);

    const bucketMap = this.bucketCounts.get(key) ?? new Map<number, number>();
    for (const bucket of this.buckets) {
      if (valueMs <= bucket) {
        bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + 1);
      }
    }
    this.bucketCounts.set(key, bucketMap);
  }

  render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];

    for (const [key, count] of this.counts.entries()) {
      const labelText = formatLabelsFromKey(this.labelNames, key);
      const bucketMap = this.bucketCounts.get(key) ?? new Map<number, number>();
      for (const bucket of this.buckets) {
        lines.push(`${this.name}_bucket${appendLabel(labelText, "le", String(bucket))} ${bucketMap.get(bucket) ?? 0}`);
      }
      lines.push(`${this.name}_bucket${appendLabel(labelText, "le", "+Inf")} ${count}`);
      lines.push(`${this.name}_sum${labelText} ${this.sums.get(key) ?? 0}`);
      lines.push(`${this.name}_count${labelText} ${count}`);
    }

    return lines.join("\n");
  }
}

export class MetricsRegistry {
  private readonly metrics: Array<Counter | Gauge | Histogram> = [];

  counter(name: string, help: string, labelNames: string[] = []): Counter {
    const metric = new Counter(name, help, labelNames);
    this.metrics.push(metric);
    return metric;
  }

  gauge(name: string, help: string, labelNames: string[] = []): Gauge {
    const metric = new Gauge(name, help, labelNames);
    this.metrics.push(metric);
    return metric;
  }

  histogram(name: string, help: string, labelNames: string[] = [], buckets?: number[]): Histogram {
    const metric = new Histogram(name, help, labelNames, buckets);
    this.metrics.push(metric);
    return metric;
  }

  render(): string {
    return this.metrics.map((metric) => metric.render()).filter(Boolean).join("\n\n");
  }
}

function pickLabels(labelNames: string[], labels: LabelValues): LabelValues {
  const picked: LabelValues = {};
  for (const name of labelNames) {
    picked[name] = labels[name] ?? "";
  }
  return picked;
}

function formatLabelsFromKey(labelNames: string[], key: string): string {
  if (labelNames.length === 0) return "";
  const values = key.split("|").map((part) => part.split("=")[1] ?? "");
  const labels: LabelValues = {};
  labelNames.forEach((name, index) => {
    labels[name] = values[index] ?? "";
  });
  return formatLabels(labels);
}

function appendLabel(labelText: string, key: string, value: string): string {
  if (!labelText) return `{${key}="${escapeLabelValue(value)}"}`;
  return labelText.replace("}", `,${key}="${escapeLabelValue(value)}"}`);
}

export function createAppMetrics() {
  const registry = new MetricsRegistry();

  return {
    registry,
    httpRequests: registry.counter(
      "weightloss_http_requests_total",
      "Total HTTP requests handled by the API",
      ["method", "route", "status"],
    ),
    httpDuration: registry.histogram(
      "weightloss_http_request_duration_ms",
      "HTTP request duration in milliseconds",
      ["method", "route"],
    ),
    cacheRequests: registry.counter(
      "weightloss_cache_requests_total",
      "Cache lookups for public/admin content",
      ["resource", "result"],
    ),
    queueJobs: registry.gauge(
      "weightloss_queue_jobs",
      "Background job counts by queue and state",
      ["queue", "state"],
    ),
  };
}

export type AppMetrics = ReturnType<typeof createAppMetrics>;
