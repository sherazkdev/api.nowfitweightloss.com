import type { UserDeviceDocument } from "@weightloss/contracts";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";
import { nextSequenceId } from "../counters.js";

export type RegisterDeviceInput = {
  firebaseUid: string;
  fcmToken: string;
  platform: "android" | "ios";
};

function collection(db: Db) {
  return db.collection<UserDeviceDocument>(COLLECTIONS.userDevices);
}

export async function upsertUserDevice(
  db: Db,
  input: RegisterDeviceInput,
): Promise<UserDeviceDocument> {
  const now = new Date();
  const existing = await collection(db).findOne({
    firebaseUid: input.firebaseUid,
    fcmToken: input.fcmToken,
  });

  if (existing) {
    await collection(db).updateOne(
      { id: existing.id },
      { $set: { platform: input.platform, lastSeenAt: now, updatedAt: now } },
    );
    return {
      ...existing,
      platform: input.platform,
      lastSeenAt: now,
      updatedAt: now,
    };
  }

  const id = await nextSequenceId(db, "userDevices");
  const doc: UserDeviceDocument = {
    id,
    firebaseUid: input.firebaseUid,
    fcmToken: input.fcmToken,
    platform: input.platform,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await collection(db).insertOne(doc);
  return doc;
}

export async function deleteUserDeviceByToken(
  db: Db,
  firebaseUid: string,
  fcmToken: string,
): Promise<boolean> {
  const result = await collection(db).deleteOne({ firebaseUid, fcmToken });
  return result.deletedCount === 1;
}

export async function listUserDeviceTokens(
  db: Db,
  firebaseUid: string,
): Promise<string[]> {
  const devices = await collection(db)
    .find({ firebaseUid }, { projection: { fcmToken: 1, _id: 0 } })
    .sort({ lastSeenAt: -1 })
    .toArray();

  return devices.map((device) => device.fcmToken);
}
