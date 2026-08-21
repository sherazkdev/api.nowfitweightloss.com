import { loadEnvSafe } from "@weightloss/config";
import { closeMongo, connectMongo, ensureIndexes } from "@weightloss/database";
import { createLogger } from "@weightloss/logger";

const log = createLogger({ name: "create-indexes" });

async function main() {
  const env = loadEnvSafe();
  const { db } = await connectMongo(env);

  log.info("Ensuring MongoDB indexes…");
  const results = await ensureIndexes(db);

  for (const item of results) {
    log.info({ collection: item.collection, index: item.name }, "index_ready");
  }

  log.info({ count: results.length }, "indexes_complete");
  await closeMongo();
}

main().catch((error) => {
  log.error({ err: error }, "create_indexes_failed");
  process.exit(1);
});
