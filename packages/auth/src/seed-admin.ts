import type { Db } from "mongodb";
import type { AppEnv } from "@weightloss/config";
import type { AdminDocument } from "@weightloss/contracts";
import { COLLECTIONS, createAdmin, findAdminByEmailNormalized, nextSequenceId } from "@weightloss/database";
import { hashPassword } from "./password.js";
import { normalizeEmail } from "@weightloss/shared";

async function writeSeedAdmin(db: Db, env: AppEnv): Promise<{ created: boolean; email: string }> {
  const emailNormalized = normalizeEmail(env.ADMIN_SEED_EMAIL);
  const passwordHash = await hashPassword(env.ADMIN_SEED_PASSWORD);
  const existing = await findAdminByEmailNormalized(db, emailNormalized);

  if (existing) {
    await db.collection(COLLECTIONS.admins).updateOne(
      { id: existing.id },
      {
        $set: {
          name: env.ADMIN_SEED_NAME,
          email: env.ADMIN_SEED_EMAIL,
          emailNormalized,
          passwordHash,
          isActive: true,
          updatedAt: new Date(),
        },
        $inc: { tokenVersion: 1 },
      },
    );
    return { created: false, email: env.ADMIN_SEED_EMAIL };
  }

  await createAdmin(db, {
    id: await nextSequenceId(db, "admins"),
    name: env.ADMIN_SEED_NAME,
    email: env.ADMIN_SEED_EMAIL,
    emailNormalized,
    passwordHash,
    tokenVersion: 0,
    isActive: true,
  });

  return { created: true, email: env.ADMIN_SEED_EMAIL };
}

/** API boot: create the first admin only when seeding is enabled and the email is new. */
export async function seedAdminIfNeeded(db: Db, env: AppEnv): Promise<{ created: boolean; email: string }> {
  if (!env.ADMIN_SEED_ENABLED) {
    return { created: false, email: env.ADMIN_SEED_EMAIL };
  }

  const emailNormalized = normalizeEmail(env.ADMIN_SEED_EMAIL);
  const existing = await findAdminByEmailNormalized(db, emailNormalized);
  if (existing) {
    return { created: false, email: env.ADMIN_SEED_EMAIL };
  }

  return writeSeedAdmin(db, env);
}

/** CLI `npm run seed`: always create or reset the seed admin from `.env`. */
export async function upsertSeedAdmin(db: Db, env: AppEnv): Promise<{ created: boolean; email: string }> {
  return writeSeedAdmin(db, env);
}

export async function countAdmins(db: Db): Promise<number> {
  return db.collection(COLLECTIONS.admins).countDocuments();
}

export type { AdminDocument };
