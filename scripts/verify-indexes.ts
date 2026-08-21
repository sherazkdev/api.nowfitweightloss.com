import { loadEnvSafe } from "@weightloss/config";
import { COLLECTIONS, closeMongo, connectMongo } from "@weightloss/database";
import { createLogger } from "@weightloss/logger";

const log = createLogger({ name: "verify-indexes" });

type Probe = {
  label: string;
  collection: string;
  filter: Record<string, unknown>;
  sort?: Record<string, 1 | -1>;
};

const PROBES: Probe[] = [
  {
    label: "mealCategories.public",
    collection: COLLECTIONS.mealCategories,
    filter: { isActive: true },
    sort: { sortOrder: 1, id: 1 },
  },
  {
    label: "meals.byCategory.public",
    collection: COLLECTIONS.meals,
    filter: { categoryIds: 1, isActive: true, gender: { $in: ["male", "both"] } },
    sort: { sortOrder: 1, id: 1 },
  },
  {
    label: "meals.byId",
    collection: COLLECTIONS.meals,
    filter: { id: 1, isActive: true },
  },
  {
    label: "workoutLevels.public",
    collection: COLLECTIONS.workoutLevels,
    filter: { isActive: true },
    sort: { sortOrder: 1, id: 1 },
  },
  {
    label: "workoutCategories.byLevel",
    collection: COLLECTIONS.workoutCategories,
    filter: { levelIds: 1, isActive: true },
    sort: { sortOrder: 1, id: 1 },
  },
  {
    label: "exercises.byBrowseKey",
    collection: COLLECTIONS.exercises,
    filter: { browseKeys: "1:4", isActive: true },
    sort: { sortOrder: 1, id: 1 },
  },
  {
    label: "exercises.byId",
    collection: COLLECTIONS.exercises,
    filter: { id: 1, isActive: true },
  },
];

async function main() {
  const env = loadEnvSafe();
  const { db } = await connectMongo(env);

  const lines: string[] = [
    "# Index verification (explain executionStats)",
    "",
    "| Route probe | Collection | Stage | Keys examined | Docs examined | Returned | ms |",
    "|---|---|---|---:|---:|---:|---:|",
  ];

  for (const probe of PROBES) {
    const cursor = db
      .collection(probe.collection)
      .find(probe.filter)
      .sort(probe.sort ?? {});

    const explain = await cursor.explain("executionStats");
    const stats = explain.executionStats;
    const stage =
      explain.queryPlanner?.winningPlan?.inputStage?.stage ??
      explain.queryPlanner?.winningPlan?.stage ??
      "unknown";

    const row = `| ${probe.label} | ${probe.collection} | ${stage} | ${stats.totalKeysExamined} | ${stats.totalDocsExamined} | ${stats.nReturned} | ${stats.executionTimeMillis} |`;
    lines.push(row);

    log.info(
      {
        probe: probe.label,
        stage,
        totalKeysExamined: stats.totalKeysExamined,
        totalDocsExamined: stats.totalDocsExamined,
        nReturned: stats.nReturned,
        executionTimeMillis: stats.executionTimeMillis,
      },
      "explain_probe",
    );

    if (stage === "COLLSCAN" && stats.totalDocsExamined > 100) {
      log.warn({ probe: probe.label }, "collscan_on_hot_probe");
    }
  }

  const { writeFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  writeFileSync(resolve("docs/INDEXES.md"), `${lines.join("\n")}\n`, "utf8");

  log.info("Wrote docs/INDEXES.md");
  await closeMongo();
}

main().catch((error) => {
  log.error({ err: error }, "verify_indexes_failed");
  process.exit(1);
});
