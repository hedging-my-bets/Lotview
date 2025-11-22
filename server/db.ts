import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  console.error('\n❌ DATABASE_URL environment variable is not set or is empty.\n');
  console.error('📝 To fix this, you need to set up a PostgreSQL database:');
  console.error('');
  console.error('Option 1 - Use Neon (Recommended):');
  console.error('  1. Go to https://neon.tech and create a free account');
  console.error('  2. Create a new project');
  console.error('  3. Copy the connection string');
  console.error('  4. In Replit, open the Secrets panel (lock icon in sidebar)');
  console.error('  5. Find DATABASE_URL and paste the connection string');
  console.error('');
  console.error('Option 2 - Use Supabase:');
  console.error('  1. Go to https://supabase.com and create a free account');
  console.error('  2. Create a new project');
  console.error('  3. Go to Settings → Database → Connection String');
  console.error('  4. Copy the connection string');
  console.error('  5. In Replit, open the Secrets panel (lock icon in sidebar)');
  console.error('  6. Find DATABASE_URL and paste the connection string');
  console.error('');
  throw new Error('DATABASE_URL must be set. Please follow the instructions above.');
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export const db = drizzle(pool, { schema });
