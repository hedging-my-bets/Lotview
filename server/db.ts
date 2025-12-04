import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import * as fs from 'fs';

// Get database URL - check /tmp/replitdb first (production), then environment variable
function getDatabaseUrl(): string | undefined {
  // In production deployments, Replit stores the external URL in /tmp/replitdb
  try {
    const replitDbPath = '/tmp/replitdb';
    if (fs.existsSync(replitDbPath)) {
      const url = fs.readFileSync(replitDbPath, 'utf-8').trim();
      if (url) {
        console.log('Using database URL from /tmp/replitdb');
        return url;
      }
    }
  } catch (e) {
    // Fall through to environment variable
  }
  
  // Fall back to environment variable
  return process.env.DATABASE_URL;
}

const databaseUrl = getDatabaseUrl();

// Use Replit's built-in database environment variables
const dbConfig = databaseUrl 
  ? { connectionString: databaseUrl }
  : {
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432'),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
    };

if (!dbConfig.connectionString && !dbConfig.host) {
  throw new Error('Database configuration not found. Please ensure the database is provisioned.');
}

export const pool = new Pool(dbConfig);
export const db = drizzle(pool, { schema });
