import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIGHTNINGCSS_VERSION = "1.32.0";

function isMuslLinux() {
  try {
    const { familySync } = require("detect-libc");
    return familySync() === "musl";
  } catch {
    try {
      const out = execSync("ldd --version 2>&1", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return /musl/i.test(out);
    } catch {
      return false;
    }
  }
}

function lightningcssNativePackage() {
  if (process.platform === "win32") {
    return process.arch === "arm64"
      ? "lightningcss-win32-arm64-msvc"
      : "lightningcss-win32-x64-msvc";
  }
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "lightningcss-darwin-arm64" : "lightningcss-darwin-x64";
  }
  if (process.platform === "linux") {
    if (process.arch === "arm64") {
      return isMuslLinux() ? "lightningcss-linux-arm64-musl" : "lightningcss-linux-arm64-gnu";
    }
    return isMuslLinux() ? "lightningcss-linux-x64-musl" : "lightningcss-linux-x64-gnu";
  }
  return null;
}

function ensurePackage(name) {
  const dir = join(root, "node_modules", name);
  if (existsSync(dir)) {
    return;
  }

  console.log(`[postinstall] Installing missing native package: ${name}@${LIGHTNINGCSS_VERSION}`);
  execSync(`npm install ${name}@${LIGHTNINGCSS_VERSION} --no-save --no-audit --no-fund`, {
    cwd: root,
    stdio: "inherit",
  });
}

const nativePackage = lightningcssNativePackage();
if (nativePackage) {
  ensurePackage(nativePackage);
}
