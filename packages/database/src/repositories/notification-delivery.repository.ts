import type {
  NotificationDeliveryDocument,
  NotificationDeliveryStatus,
  ReminderGender,
} from "@weightloss/contracts";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";
import { nextSequenceId } from "../counters.js";

export type RecordNotificationDeliveryInput = {
  firebaseUid: string;
  reminderId: number;
  gender: ReminderGender;
  hour: number;
  minute: number;
  tokenCount: number;
  successCount: number;
  failureCount: number;
  slotKey: string;
  errorMessage?: string | null;
};

function collection(db: Db) {
  return db.collection<NotificationDeliveryDocument>(COLLECTIONS.notificationDeliveries);
}

function deriveStatus(input: {
  tokenCount: number;
  successCount: number;
  failureCount: number;
  errorMessage?: string | null;
}): NotificationDeliveryStatus {
  if (input.tokenCount === 0 || input.errorMessage) {
    return input.tokenCount === 0 ? "skipped" : "failed";
  }
  if (input.failureCount === 0 && input.successCount > 0) return "delivered";
  if (input.successCount === 0) return "failed";
  return "partial";
}

export async function recordNotificationDelivery(
  db: Db,
  input: RecordNotificationDeliveryInput,
): Promise<NotificationDeliveryDocument> {
  const now = new Date();
  const doc: NotificationDeliveryDocument = {
    id: await nextSequenceId(db, "notificationDeliveries"),
    firebaseUid: input.firebaseUid,
    reminderId: input.reminderId,
    gender: input.gender,
    hour: input.hour,
    minute: input.minute,
    tokenCount: input.tokenCount,
    successCount: input.successCount,
    failureCount: input.failureCount,
    status: deriveStatus(input),
    slotKey: input.slotKey,
    errorMessage: input.errorMessage ?? null,
    createdAt: now,
  };

  await collection(db).insertOne(doc);
  return doc;
}

export async function findNotificationDeliveryById(
  db: Db,
  id: number,
): Promise<NotificationDeliveryDocument | null> {
  return collection(db).findOne({ id });
}
