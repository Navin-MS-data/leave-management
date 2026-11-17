import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { todayISO } from '../common/dates';
import { buildDataSourceOptions } from '../database/database.config';
import { SEED_PASSWORD, seed } from './seed';

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error('Refusing to seed (which wipes all data) when NODE_ENV=production');
  }

  // Seeding recreates the schema, so it uses the direct (non-pooled) Neon connection if provided.
  const ds = new DataSource({ ...buildDataSourceOptions({ direct: true }), synchronize: false });
  await ds.initialize();
  try {
    const result = await seed(ds, { today: todayISO(), reset: true });
    console.log(`Seeded ${result.requests} leave requests.`);
    console.log('\nDemo accounts (password for all: %s)', SEED_PASSWORD);
    console.log('  admin     admin@example.com');
    console.log('  manager   manager1@example.com, manager2@example.com');
    console.log('  employee  employee1@example.com ... employee8@example.com');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
