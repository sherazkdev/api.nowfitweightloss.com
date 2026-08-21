export function buildBrowseKeys(levelIds: number[], categoryIds: number[]): string[] {
  const keys = new Set<string>();
  for (const levelId of levelIds) {
    for (const categoryId of categoryIds) {
      keys.add(`${levelId}:${categoryId}`);
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}
