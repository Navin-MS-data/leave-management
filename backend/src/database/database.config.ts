import { DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from '../entities';

/**
 * Builds the TypeORM options from the environment.
 *
 * Neon: the app uses the pooled URL (DATABASE_URL). Schema changes and seeding can pass
 * `direct: true` to use DATABASE_URL_DIRECT (a non-pooled connection) instead.
 */
export function buildDataSourceOptions(opts: { direct?: boolean } = {}): DataSourceOptions {
  const url = (opts.direct && process.env.DATABASE_URL_DIRECT) || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.');
  }
  const useSsl = /sslmode=require/.test(url) || /neon\.tech/.test(url);
  return {
    type: 'postgres',
    url,
    ssl: useSsl ? { rejectUnauthorized: true } : false,
    entities: ALL_ENTITIES,
    synchronize: process.env.DB_SYNCHRONIZE !== 'false',
    // Neon suspends idle compute; allow time for the first query to wake it up.
    connectTimeoutMS: 30_000,
    extra: { max: 10, idleTimeoutMillis: 30_000 },
  };
}
