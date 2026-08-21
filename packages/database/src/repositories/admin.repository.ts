import type { Db } from "mongodb";
import type { AdminDocument } from "@weightloss/contracts";
import { COLLECTIONS } from "../collections.js";

export type CreateAdminInput = {
  id: number;
  name: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  tokenVersion?: number;
  isActive?: boolean;
};

export async function findAdminByEmailNormalized(
  db: Db,
  emailNormalized: string,
): Promise<AdminDocument | null> {
  return db.collection<AdminDocument>(COLLECTIONS.admins).findOne({ emailNormalized });
}

export async function findAdminById(db: Db, id: number): Promise<AdminDocument | null> {
  return db.collection<AdminDocument>(COLLECTIONS.admins).findOne({ id });
}

export async function createAdmin(db: Db, input: CreateAdminInput): Promise<AdminDocument> {
  const now = new Date();
  const admin: AdminDocument = {
    id: input.id,
    name: input.name,
    email: input.email,
    emailNormalized: input.emailNormalized,
    passwordHash: input.passwordHash,
    tokenVersion: input.tokenVersion ?? 0,
    isActive: input.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<AdminDocument>(COLLECTIONS.admins).insertOne(admin);
  return admin;
}
