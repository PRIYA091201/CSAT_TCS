@echo off
REM SQL Migration Runner for CSat Project
REM Run this file from your local machine with Supabase CLI installed

echo Installing Supabase CLI if needed...
npm install -g supabase

echo.
echo ===== Running Migration 001: Schema =====
supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.mxfuufwztkgirdjjxkci.supabase.co:5432/postgres" --file supabase/migrations/001_schema.sql

echo.
echo ===== Running Migration 002: RLS Policies =====
supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.mxfuufwztkgirdjjxkci.supabase.co:5432/postgres" --file supabase/migrations/002_rls_policies.sql

echo.
echo ===== Running Migration 003: Audit Logs =====
supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.mxfuufwztkgirdjjxkci.supabase.co:5432/postgres" --file supabase/migrations/003_audit_logs.sql

echo.
echo ===== Running Seed Data =====
supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.mxfuufwztkgirdjjxkci.supabase.co:5432/postgres" --file supabase/seed.sql

echo.
echo ===== Running Test Kiosks =====
supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.mxfuufwztkgirdjjxkci.supabase.co:5432/postgres" --file supabase/create_test_kiosks.sql

echo.
echo ===== DONE! =====
pause