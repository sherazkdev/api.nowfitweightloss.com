import type { CounterName } from "@weightloss/contracts";
import type { Db } from "mongodb";
import { COLLECTIONS, type CounterDocument } from "./collections.js";

export async function nextSequenceId(db: Db, name: CounterName): Promise<number> {
  const result = await db.collection<CounterDocument>(COLLECTIONS.counters).findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );

  if (!result?.seq) {
    throw new Error(`Failed to allocate sequence for counter: ${name}`);
  }

  return result.seq;
}

export async function reserveSequenceBlock(
  db: Db,
  name: CounterName,
  count: number,
): Promise<{ start: number; end: number }> {
  if (count < 1) {
    throw new Error("count must be >= 1");
  }

  const result = await db.collection<CounterDocument>(COLLECTIONS.counters).findOneAndUpdate(
    { _id: name },
    { $inc: { seq: count } },
    { upsert: true, returnDocument: "after" },
  );

  if (!result?.seq) {
    throw new Error(`Failed to reserve sequence block for counter: ${name}`);
  }

  const end = result.seq;
  const start = end - count + 1;
  return { start, end };
}

export async function setSequenceFloor(
  db: Db,
  name: CounterName,
  minimum: number,
): Promise<void> {
  await db.collection<CounterDocument>(COLLECTIONS.counters).updateOne(
    { _id: name },
    [{ $set: { seq: { $max: [{ $ifNull: ["$seq", 0] }, minimum] } } }],
    { upsert: true },
  );
}
