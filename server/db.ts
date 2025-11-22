import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

let connectionString = process.env.DATABASE_URL;

if (!connectionString || connectionString.trim() === '') {
  const { PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT } = process.env;
  if (PGHOST && PGUSER && PGDATABASE && PGPORT) {
    const password = PGPASSWORD ? `:${PGPASSWORD}` : '';
    connectionString = `postgresql://${PGUSER}${password}@${PGHOST}:${PGPORT}/${PGDATABASE}`;
    console.log('Constructed DATABASE_URL from individual PG environment variables');
  } else {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
}

export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });
