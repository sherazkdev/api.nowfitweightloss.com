const UNIT_MS: Record<string, number> = {
  second: 1_000,
  seconds: 1_000,
  sec: 1_000,
  s: 1_000,
  minute: 60_000,
  minutes: 60_000,
  min: 60_000,
  m: 60_000,
  hour: 3_600_000,
  hours: 3_600_000,
  hr: 3_600_000,
  h: 3_600_000,
  day: 86_400_000,
  days: 86_400_000,
  d: 86_400_000,
};

export function parseDurationMs(input: string): number {
  const trimmed = input.trim().toLowerCase();
  const match = /^(\d+(?:\.\d+)?)\s*([a-z]+)$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid duration: ${input}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "";
  const multiplier = UNIT_MS[unit];
  if (!multiplier) {
    throw new Error(`Unsupported duration unit in: ${input}`);
  }

  return Math.round(amount * multiplier);
}

export function ttlWithJitter(baseSeconds: number, jitterRatio = 0.1): number {
  if (baseSeconds <= 0) return baseSeconds;
  const jitter = Math.floor(baseSeconds * jitterRatio * Math.random());
  return baseSeconds + jitter;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
