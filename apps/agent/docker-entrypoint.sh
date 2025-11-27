#!/bin/sh
set -e

echo "Starting DKG Agent..."

if [ -n "$RAILWAY_PUBLIC_DOMAIN" ] && [ -z "$BIASLENS_APP_URL" ]; then
  export BIASLENS_APP_URL="https://$RAILWAY_PUBLIC_DOMAIN"
  echo "Auto-configured BIASLENS_APP_URL=$BIASLENS_APP_URL"
fi

if [ -n "$RAILWAY_PUBLIC_DOMAIN" ] && [ -z "$EXPO_PUBLIC_APP_URL" ]; then
  export EXPO_PUBLIC_APP_URL="https://$RAILWAY_PUBLIC_DOMAIN"
  export EXPO_PUBLIC_MCP_URL="https://$RAILWAY_PUBLIC_DOMAIN"
  echo "Auto-configured EXPO_PUBLIC_APP_URL=$EXPO_PUBLIC_APP_URL"
fi

if [ -n "$MYSQL_URL" ]; then
  echo "Waiting for MySQL..."
  sleep 5
fi

echo "Running database migrations..."
node -e "
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  const Database = require('better-sqlite3');
  const { migrate } = require('drizzle-orm/better-sqlite3/migrator');

  const dbPath = process.env.DATABASE_URL || '/app/data/production.db';
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);

  migrate(db, { migrationsFolder: './drizzle/sqlite' });
  console.log('Migrations complete');
" || echo "Migrations may have failed, continuing..."

echo "Seeding users..."
node dist/scripts/setup.js || echo "Users may already exist"

echo "Starting server on port $PORT..."
exec node dist/index.js
