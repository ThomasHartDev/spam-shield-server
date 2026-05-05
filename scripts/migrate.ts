import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { env } from "../lib/env";

const sql = neon(env.DATABASE_URL);
const db = drizzle(sql);

async function main() {
  console.log("Running migrations against:", env.DATABASE_URL.replace(/:[^@]*@/, ":***@"));
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
