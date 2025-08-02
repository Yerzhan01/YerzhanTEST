import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // максимум соединений
  idleTimeoutMillis: 30000,   // таймаут простоя 30 сек
  connectionTimeoutMillis: 2000, // таймаут подключения 2 сек
  allowExitOnIdle: true       // закрывать при простое
});

export const db = drizzle({ client: pool, schema });