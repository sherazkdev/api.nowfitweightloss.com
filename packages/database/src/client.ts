import { Resolver, resolveSrv } from "node:dns/promises";
import { MongoClient, type Db, type MongoClientOptions } from "mongodb";
import type { AppEnv } from "@weightloss/config";

export type MongoConnection = {
  client: MongoClient;
  db: Db;
};

let shared: MongoConnection | null = null;

function srvLookupName(hostname: string): string {
  return `_mongodb._tcp.${hostname}`;
}

function parseSrvMongoUrl(uri: string): URL | null {
  if (!uri.startsWith("mongodb+srv://")) return null;
  try {
    return new URL(uri.replace(/^mongodb\+srv:\/\//, "https://"));
  } catch {
    return null;
  }
}

/**
 * Node on Windows often cannot query SRV via ISP DNS (`querySrv ECONNREFUSED`).
 * Resolve Atlas hosts with public DNS and hand the driver a standard mongodb:// URI.
 */
async function resolveMongoUri(uri: string): Promise<string> {
  const parsed = parseSrvMongoUrl(uri);
  if (!parsed) return uri;

  try {
    await resolveSrv(srvLookupName(parsed.hostname));
    return uri;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ECONNREFUSED" && code !== "ETIMEOUT" && code !== "ENOTFOUND" && code !== "ESERVFAIL") {
      throw error;
    }
  }

  const resolver = new Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);

  const records = await resolver.resolveSrv(srvLookupName(parsed.hostname));
  if (records.length === 0) {
    throw new Error(`No MongoDB SRV records for ${parsed.hostname}`);
  }

  const txt = (await resolver.resolveTxt(parsed.hostname)).flat().join("");
  const hosts = records.map((record) => `${record.name}:${record.port}`).join(",");
  const auth =
    parsed.username === ""
      ? ""
      : `${encodeURIComponent(parsed.username)}:${encodeURIComponent(parsed.password)}@`;
  const pathname = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "/";
  const params = new URLSearchParams(parsed.search);

  for (const pair of txt.split("&")) {
    const [key, value] = pair.split("=");
    if (key && value) params.set(key, decodeURIComponent(value));
  }

  if (!params.has("tls") && !params.has("ssl")) {
    params.set("tls", "true");
  }

  return `mongodb://${auth}${hosts}${pathname}?${params.toString()}`;
}

export function createMongoClient(env: AppEnv, overrides?: MongoClientOptions): MongoClient {
  return new MongoClient(env.MONGODB_URI, {
    minPoolSize: env.MONGODB_MIN_POOL_SIZE,
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    maxIdleTimeMS: env.MONGODB_MAX_IDLE_TIME_MS,
    serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    connectTimeoutMS: env.MONGODB_CONNECT_TIMEOUT_MS,
    ...overrides,
  });
}

export async function connectMongo(
  env: AppEnv,
  overrides?: MongoClientOptions,
): Promise<MongoConnection> {
  if (shared) return shared;

  const uri = await resolveMongoUri(env.MONGODB_URI);
  const client = new MongoClient(uri, {
    minPoolSize: env.MONGODB_MIN_POOL_SIZE,
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    maxIdleTimeMS: env.MONGODB_MAX_IDLE_TIME_MS,
    serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    connectTimeoutMS: env.MONGODB_CONNECT_TIMEOUT_MS,
    ...overrides,
  });
  await client.connect();
  const db = client.db(env.MONGODB_DB);
  shared = { client, db };
  return shared;
}

export function getMongo(): MongoConnection {
  if (!shared) {
    throw new Error("MongoDB is not connected. Call connectMongo() first.");
  }
  return shared;
}

export async function pingMongo(db: Db): Promise<void> {
  await db.command({ ping: 1 });
}

export async function closeMongo(): Promise<void> {
  if (!shared) return;
  await shared.client.close();
  shared = null;
}

/** Test helper — reset module singleton */
export function resetMongoForTests(): void {
  shared = null;
}
