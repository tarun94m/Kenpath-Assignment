import pg from 'pg';
import { config } from '../config/index.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

// Run fn(client) in one transaction; commit on success, roll back on any error.
export async function withTransaction(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
