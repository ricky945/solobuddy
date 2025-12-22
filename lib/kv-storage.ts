import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

type KvRow = {
  key: string;
  value: string;
  updatedAt: number;
};

const DB_NAME = "solobuddy_kv.db";
const TABLE_NAME = "kv";

let initPromise: Promise<void> | null = null;
let db: SQLite.SQLiteDatabase | null = null;
let sqliteAvailable: boolean | null = null;

function isProbablyAvailableError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.toLowerCase();
}

async function ensureSqliteReady(): Promise<boolean> {
  if (sqliteAvailable !== null) return sqliteAvailable;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        console.log("[KVStorage] Initializing SQLite storage...", { platform: Platform.OS });
        db = await SQLite.openDatabaseAsync(DB_NAME);
        await db.execAsync(
          `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (\n` +
            `  key TEXT PRIMARY KEY NOT NULL,\n` +
            `  value TEXT NOT NULL,\n` +
            `  updatedAt INTEGER NOT NULL\n` +
            `);`
        );
        sqliteAvailable = true;
        console.log("[KVStorage] SQLite ready");
      } catch (e) {
        const msg = isProbablyAvailableError(e);
        sqliteAvailable = false;
        db = null;
        console.warn("[KVStorage] SQLite unavailable, falling back to AsyncStorage", { msg });
      }
    })();
  }

  await initPromise;
  return sqliteAvailable ?? false;
}

async function getFromSqlite(key: string): Promise<string | null> {
  if (!db) return null;

  const row = await db.getFirstAsync<KvRow>(
    `SELECT key, value, updatedAt FROM ${TABLE_NAME} WHERE key = ? LIMIT 1;`,
    [key]
  );
  return row?.value ?? null;
}

async function setInSqlite(key: string, value: string): Promise<void> {
  if (!db) return;

  await db.runAsync(
    `INSERT INTO ${TABLE_NAME} (key, value, updatedAt) VALUES (?, ?, ?)\n` +
      `ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt;`,
    [key, value, Date.now()]
  );
}

async function removeFromSqlite(key: string): Promise<void> {
  if (!db) return;
  await db.runAsync(`DELETE FROM ${TABLE_NAME} WHERE key = ?;`, [key]);
}

export async function kvGetItem(key: string): Promise<string | null> {
  try {
    const canUseSqlite = await ensureSqliteReady();
    if (canUseSqlite) {
      const sqliteValue = await getFromSqlite(key);
      if (sqliteValue !== null) return sqliteValue;

      const legacy = await AsyncStorage.getItem(key);
      if (legacy !== null) {
        console.log("[KVStorage] Migrating legacy AsyncStorage key to SQLite", { key });
        try {
          await setInSqlite(key, legacy);
          await AsyncStorage.removeItem(key);
        } catch (e) {
          console.warn("[KVStorage] Failed to migrate legacy key", { key, msg: String(e) });
        }
      }
      return legacy;
    }

    return await AsyncStorage.getItem(key);
  } catch (e) {
    console.error("[KVStorage] kvGetItem failed, falling back to AsyncStorage", { key, msg: String(e) });
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

export async function kvSetItem(key: string, value: string): Promise<void> {
  try {
    const canUseSqlite = await ensureSqliteReady();
    if (canUseSqlite) {
      await setInSqlite(key, value);
      return;
    }

    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.error("[KVStorage] kvSetItem failed, falling back to AsyncStorage", { key, msg: String(e) });
    await AsyncStorage.setItem(key, value);
  }
}

export async function kvRemoveItem(key: string): Promise<void> {
  try {
    const canUseSqlite = await ensureSqliteReady();
    if (canUseSqlite) {
      await removeFromSqlite(key);
      return;
    }

    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.error("[KVStorage] kvRemoveItem failed, falling back to AsyncStorage", { key, msg: String(e) });
    await AsyncStorage.removeItem(key);
  }
}
