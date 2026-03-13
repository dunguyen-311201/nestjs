#!/bin/sh
set -e
echo "Starting e-commerce-api entrypoint..."

echo "Running migrations..."
tsx /usr/src/app/node_modules/typeorm/cli-ts-node-commonjs.js \
  migration:run -d ./src/database/data-source.ts

# Run seed data if requested
if [ "$SEED_DATA" = "true" ]; then
    echo "Seeding database..."
    tsx /usr/src/app/node_modules/typeorm/cli-ts-node-commonjs.js \
      migration:run -d ./src/database/seed-data-source.ts
fi

echo "Starting application..."
exec node --import tsx build/server.js
