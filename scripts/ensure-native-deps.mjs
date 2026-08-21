import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const VERSIONS = {
  lightningcss: "1.32.0",
  tailwindOxide: "4.3.3",
};

function isMuslLinux() {
  try {
    const { familySync } = require("detect-libc");
    return familySync() === "musl";
  } catch {
    try {
      const out = execSync("ldd --version 2>&1", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return /musl/i.test(out);
    } catch {
      return false;
    }
  }
}

function platformSuffix() {
  if (process.platform === "win32") {
    return process.arch === "arm64" ? "win32-arm64-msvc" : "win32-x64-msvc";
  }
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  }
  if (process.platform === "linux") {
    if (process.arch === "arm64") {
      return isMuslLinux() ? "linux-arm64-musl" : "linux-arm64-gnu";
    }
    return isMuslLinux() ? "linux-x64-musl" : "linux-x64-gnu";
  }
  return null;
}

function requiredNativePackages() {
  const suffix = platformSuffix();
  if (!suffix) {
    return [];
  }

  return [
    { name: `lightningcss-${suffix}`, version: VERSIONS.lightningcss },
    { name: `@tailwindcss/oxide-${suffix}`, version: VERSIONS.tailwindOxide },
  ];
}

function ensurePackage(name, version) {
  const dir = join(root, "node_modules", name);
  if (existsSync(dir)) {
    console.log(`[postinstall] ${name} ok`);
    return;
  }

  console.log(`[postinstall] Installing missing native package: ${name}@${version}`);
  execSync(`npm install ${name}@${version} --no-save --no-audit --no-fund`, {
    cwd: root,
    stdio: "inherit",
  });
}

for (const pkg of requiredNativePackages()) {
  ensurePackage(pkg.name, pkg.version);
}
