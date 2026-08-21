export function userWeightMongoClause(weight: number): Record<string, unknown> {
  return {
    $or: [
      { minWeight: 0, maxWeight: 0 },
      { minWeight: { $lte: weight }, maxWeight: { $gte: weight } },
    ],
  };
}
