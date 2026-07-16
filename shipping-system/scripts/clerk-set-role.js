#!/usr/bin/env node
// Assign a role to a Clerk user: node scripts/clerk-set-role.js <email> <role>
// Requires CLERK_SECRET_KEY in the environment (or in ./.env).
// Valid roles: customer, shipper, hub_staff, dispatcher, admin

const fs = require('fs');
const path = require('path');

const ROLES = ['customer', 'shipper', 'hub_staff', 'dispatcher', 'admin'];
const API = 'https://api.clerk.com/v1';

function loadSecretKey() {
  if (process.env.CLERK_SECRET_KEY) return process.env.CLERK_SECRET_KEY;
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const match = fs
      .readFileSync(envPath, 'utf8')
      .match(/^CLERK_SECRET_KEY=(.+)$/m);
    if (match) return match[1].trim();
  }
  return null;
}

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !ROLES.includes(role)) {
    console.error(`Usage: node scripts/clerk-set-role.js <email> <role>`);
    console.error(`Valid roles: ${ROLES.join(', ')}`);
    process.exit(1);
  }
  const secretKey = loadSecretKey();
  if (!secretKey) {
    console.error('CLERK_SECRET_KEY not set (env or .env)');
    process.exit(1);
  }
  const headers = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
  };

  const listRes = await fetch(
    `${API}/users?email_address=${encodeURIComponent(email)}`,
    { headers },
  );
  if (!listRes.ok) {
    console.error(`Clerk API error ${listRes.status}: ${await listRes.text()}`);
    process.exit(1);
  }
  const users = await listRes.json();
  if (!Array.isArray(users) || users.length === 0) {
    console.error(`No Clerk user found with email ${email}`);
    process.exit(1);
  }
  const user = users[0];

  const patchRes = await fetch(`${API}/users/${user.id}/metadata`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ public_metadata: { role } }),
  });
  if (!patchRes.ok) {
    console.error(
      `Failed to set role (${patchRes.status}): ${await patchRes.text()}`,
    );
    process.exit(1);
  }
  console.log(`OK: ${email} (${user.id}) -> role "${role}"`);
  console.log(
    'Note: the role lands in new session tokens only; refresh the token in the web app.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
