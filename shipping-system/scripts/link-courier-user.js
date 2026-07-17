#!/usr/bin/env node
// Link a Clerk user (shipper account) to a COURIER row:
//   node scripts/link-courier-user.js <courier_id> <clerk_user_id>
//   node scripts/link-courier-user.js --list
// Uses POSTGRES_* from the environment (defaults match docker-compose).

const { Client } = require('pg');

function buildClient() {
  return new Client({
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.POSTGRES_DB ?? 'postgres',
  });
}

async function main() {
  const [arg1, arg2] = process.argv.slice(2);
  if (!arg1) {
    console.error(
      'Usage: node scripts/link-courier-user.js <courier_id> <clerk_user_id> | --list',
    );
    process.exit(1);
  }

  const client = buildClient();
  await client.connect();
  try {
    if (arg1 === '--list') {
      const { rows } = await client.query(
        'SELECT id, zone_id, role, status, user_id FROM shipping_courier_db.courier ORDER BY created_at LIMIT 20',
      );
      console.table(rows);
      return;
    }
    if (!arg2) {
      console.error('Missing <clerk_user_id>');
      process.exit(1);
    }
    const { rowCount } = await client.query(
      'UPDATE shipping_courier_db.courier SET user_id = $2, updated_at = NOW() WHERE id = $1',
      [arg1, arg2],
    );
    if (rowCount === 0) {
      console.error(`No courier found with id ${arg1}`);
      process.exit(1);
    }
    console.log(`Linked courier ${arg1} -> ${arg2}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
