export function normalizeRelativeKey(relativeKey: string): string {
  return relativeKey.replace(/^\/+/, "").replace(/\.\./g, "");
}
