import { DatabaseSync } from "node:sqlite";

import { migrateLegacySqlite } from "../src/lib/holding-migration.ts";

const dbPath = process.argv[2] ?? "prisma/dev.db";
const db = new DatabaseSync(dbPath);
const result = migrateLegacySqlite(db);
db.close();
console.log(result.migrated ? `migrated ${dbPath}` : `already-migrated ${dbPath}`);
