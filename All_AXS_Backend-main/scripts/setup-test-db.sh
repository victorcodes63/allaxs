#!/bin/bash

# Setup test database for CI/local testing
# This script creates the database and required extensions
# Supports both DATABASE_URL_TEST and individual connection parameters

set -e  # Exit on error

echo "🔧 Setting up test database..."

# Parse DATABASE_URL_TEST if provided, otherwise use individual parameters
if [ -n "$DATABASE_URL_TEST" ]; then
  # Extract connection details from DATABASE_URL_TEST
  # Format: postgres://user:password@host:port/database
  DB_URL=$DATABASE_URL_TEST
  
  # Use a simple regex to extract components (bash doesn't have built-in URL parsing)
  # This handles the most common format: postgres://user:pass@host:port/dbname
  DB_USER=$(echo $DB_URL | sed -n 's|postgres://\([^:]*\):.*|\1|p')
  DB_PASS=$(echo $DB_URL | sed -n 's|postgres://[^:]*:\([^@]*\)@.*|\1|p')
  DB_HOST=$(echo $DB_URL | sed -n 's|postgres://[^@]*@\([^:]*\):.*|\1|p')
  DB_PORT=$(echo $DB_URL | sed -n 's|postgres://[^@]*@[^:]*:\([^/]*\)/.*|\1|p')
  DB_NAME=$(echo $DB_URL | sed -n 's|postgres://[^/]*/\([^?]*\).*|\1|p')
  
  # Fallback to defaults if parsing fails
  DB_HOST=${DB_HOST:-localhost}
  DB_PORT=${DB_PORT:-5432}
  DB_NAME=${DB_NAME:-test_db}
  DB_USER=${DB_USER:-test_user}
  DB_PASS=${DB_PASS:-test_password}
  
  echo "📋 Using DATABASE_URL_TEST"
else
  # Use individual connection parameters
  DB_HOST=${DB_HOST:-localhost}
  DB_PORT=${DB_PORT:-5432}
  # Prefer DB_NAME_TEST in test environment, fall back to DB_NAME
  DB_NAME=${DB_NAME_TEST:-${DB_NAME:-test_db}}
  DB_USER=${DB_USER:-test_user}
  DB_PASS=${DB_PASS:-test_password}
  
  echo "📋 Using individual connection parameters"
fi

# Export password for psql
export PGPASSWORD=$DB_PASS

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER 2>/dev/null; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

echo "✅ PostgreSQL is ready"

# Create database if it doesn't exist (for local development)
echo "📦 Creating database if needed..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME"

# Enable required extensions
echo "🔌 Enabling PostgreSQL extensions..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS citext;" || true
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" || true

echo "✅ Database setup complete!"
echo ""
echo "Database: $DB_NAME"
echo "Host:     $DB_HOST:$DB_PORT"
echo "User:     $DB_USER"

