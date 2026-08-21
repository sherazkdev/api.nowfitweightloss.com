import type { Db } from "mongodb";
import { INDEX_DEFINITIONS } from "./collections.js";

export type EnsureIndexesResult = {
  name: string;
  collection: string;
};

export async function ensureIndexes(db: Db): Promise<EnsureIndexesResult[]> {
  const results: EnsureIndexesResult[] = [];

  for (const definition of INDEX_DEFINITIONS) {
    const collection = db.collection(definition.collection);
    await collection.createIndex(definition.keys, {
      name: definition.name,
      ...(definition.unique ? { unique: true } : {}),
      ...(definition.partialFilterExpression
        ? { partialFilterExpression: definition.partialFilterExpression }
        : {}),
    });

    results.push({
      name: definition.name,
      collection: definition.collection,
    });
  }

  return results;
}

export async function listCollectionIndexes(db: Db, collectionName: string) {
  return db.collection(collectionName).indexes();
}
