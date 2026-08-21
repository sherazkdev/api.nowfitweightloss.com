import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

let loaded = false;

function findEnvPath(): string | null {
  let dir = process.cwd();

  while (true) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

export function loadDotenvOnce(): void {
  if (loaded) return;

  const envPath = findEnvPath();
  if (envPath) {
    loadDotenv({ path: envPath });
  }

  loaded = true;
}

export function resetDotenvForTests(): void {
  loaded = false;
}
