import type { ReminderGender, WorkoutReminderDocument } from "@weightloss/contracts";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";
import { nextSequenceId } from "../counters.js";

export type WorkoutReminderWriteInput = {
  firebaseUid: string;
  gender: ReminderGender;
  hour: number;
  minute: number;
  days: number[];
  enabled: boolean;
  timezone: string;
};

function collection(db: Db) {
  return db.collection<WorkoutReminderDocument>(COLLECTIONS.workoutReminders);
}

export async function listWorkoutRemindersByUser(
  db: Db,
  firebaseUid: string,
  gender: ReminderGender,
): Promise<WorkoutReminderDocument[]> {
  return collection(db)
    .find({ firebaseUid, gender })
    .sort({ id: 1 })
    .toArray();
}

export async function findWorkoutReminderById(
  db: Db,
  id: number,
): Promise<WorkoutReminderDocument | null> {
  return collection(db).findOne({ id });
}

export async function findWorkoutReminderForUser(
  db: Db,
  id: number,
  firebaseUid: string,
): Promise<WorkoutReminderDocument | null> {
  return collection(db).findOne({ id, firebaseUid });
}

export async function createWorkoutReminder(
  db: Db,
  input: WorkoutReminderWriteInput,
): Promise<WorkoutReminderDocument> {
  const now = new Date();
  const id = await nextSequenceId(db, "workoutReminders");
  const doc: WorkoutReminderDocument = {
    id,
    firebaseUid: input.firebaseUid,
    gender: input.gender,
    hour: input.hour,
    minute: input.minute,
    days: input.days,
    enabled: input.enabled,
    timezone: input.timezone,
    lastSentSlot: null,
    createdAt: now,
    updatedAt: now,
  };

  await collection(db).insertOne(doc);
  return doc;
}

export async function updateWorkoutReminder(
  db: Db,
  id: number,
  firebaseUid: string,
  input: WorkoutReminderWriteInput,
): Promise<WorkoutReminderDocument | null> {
  const now = new Date();
  const result = await collection(db).findOneAndUpdate(
    { id, firebaseUid },
    {
      $set: {
        gender: input.gender,
        hour: input.hour,
        minute: input.minute,
        days: input.days,
        enabled: input.enabled,
        timezone: input.timezone,
        lastSentSlot: null,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  return result ?? null;
}

export async function setWorkoutReminderEnabled(
  db: Db,
  id: number,
  firebaseUid: string,
  enabled: boolean,
): Promise<WorkoutReminderDocument | null> {
  const now = new Date();
  const result = await collection(db).findOneAndUpdate(
    { id, firebaseUid },
    {
      $set: {
        enabled,
        updatedAt: now,
        ...(enabled ? {} : { lastSentSlot: null }),
      },
    },
    { returnDocument: "after" },
  );

  return result ?? null;
}

export async function deleteWorkoutReminder(
  db: Db,
  id: number,
  firebaseUid: string,
): Promise<boolean> {
  const result = await collection(db).deleteOne({ id, firebaseUid });
  return result.deletedCount === 1;
}

export async function listEnabledWorkoutReminders(
  db: Db,
): Promise<WorkoutReminderDocument[]> {
  return collection(db)
    .find({ enabled: true })
    .project<WorkoutReminderDocument>({
      id: 1,
      firebaseUid: 1,
      gender: 1,
      hour: 1,
      minute: 1,
      days: 1,
      enabled: 1,
      timezone: 1,
      lastSentSlot: 1,
      createdAt: 1,
    })
    .sort({ id: 1 })
    .toArray();
}

export async function markWorkoutReminderSent(
  db: Db,
  id: number,
  slotKey: string,
): Promise<void> {
  await collection(db).updateOne(
    { id },
    {
      $set: {
        lastSentSlot: slotKey,
        updatedAt: new Date(),
      },
    },
  );
}
