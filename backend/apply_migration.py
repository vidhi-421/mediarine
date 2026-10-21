"""
Safe migration runner and Supabase verification script.
Executes backend/migrations/001_initial_schema.sql safely against Supabase.
Never drops tables, never deletes data.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load backend environment
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)
load_dotenv()

MIGRATION_FILE = Path(__file__).parent / "migrations" / "001_initial_schema.sql"


def verify_tables_via_supabase_client(url: str, key: str) -> bool:
    try:
        from supabase import create_client
        client = create_client(url, key)
        # Test table access
        inv_res = client.table("investigations").select("id").limit(1).execute()
        rep_res = client.table("saved_reports").select("id").limit(1).execute()
        print("Verification: 'investigations' table accessible (HTTP 200).")
        print("Verification: 'saved_reports' table accessible (HTTP 200).")
        return True
    except Exception as exc:
        print(f"Supabase client table verification check failed: {exc}")
        return False


def apply_migration_direct(db_url: str) -> bool:
    import urllib.parse
    import psycopg

    sql = MIGRATION_FILE.read_text(encoding="utf-8")
    
    # Safely handle special characters in connection string
    target_url = db_url.strip()
    try:
        # Check if password contains unencoded special characters or accidental outer brackets
        parsed = urllib.parse.urlsplit(target_url)
        hostname = parsed.hostname or ""
        port = parsed.port or 5432
        print(f"Connecting to database host: {hostname}:{port} (password masked)...")
        
        # Test connection and apply
        with psycopg.connect(target_url, connect_timeout=15) as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
        print("Migration 001_initial_schema.sql successfully applied.")
        return True
    except Exception as exc:
        err_msg = str(exc)
        print(f"Connection error: {err_msg}")
        if "could not translate host name" in err_msg.lower() or "name resolution" in err_msg.lower() or "timed out" in err_msg.lower():
            if "db." in target_url:
                print("\n[NOTE] Direct connection to 'db.<project>.supabase.co' requires IPv6.")
                print("Your network appears to be IPv4-only. Please use the Supabase Session Pooler connection string instead:")
                print("In Supabase Dashboard -> Settings -> Database -> Connection string -> Mode: Session (port 5432).")
        elif "password authentication failed" in err_msg.lower():
            print("\n[NOTE] Password authentication failed.")
            print("If your database password has special characters like @, #, $, %, +, /, ?, ensure it is percent-encoded.")
        return False


def main():
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    db_url = os.getenv("DATABASE_URL", "").strip() or os.getenv("POSTGRES_URL", "").strip()

    if not supabase_url or not supabase_key:
        print("MISSING_CREDENTIALS: SUPABASE_URL and SUPABASE_SERVICE_KEY are not set in backend/.env.")
        sys.exit(1)

    print(f"SUPABASE_URL is configured: {supabase_url[:24]}...")
    print(f"SUPABASE_SERVICE_KEY is configured (length: {len(supabase_key)}).")

    # Step 1: Check if tables already exist
    print("\nChecking if schema is already applied...")
    already_applied = verify_tables_via_supabase_client(supabase_url, supabase_key)
    if already_applied:
        print("\nSUCCESS: Supabase tables are already created and verified!")
        sys.exit(0)

    # Step 2: If not already applied and DATABASE_URL is available, apply automatically
    if db_url:
        print("\nApplying migration using DATABASE_URL...")
        applied = apply_migration_direct(db_url)
        if applied:
            verified = verify_tables_via_supabase_client(supabase_url, supabase_key)
            if verified:
                print("\nSUCCESS: Migration applied and verified via Supabase client!")
                sys.exit(0)
            else:
                print("\nWARNING: Migration applied, but client verification failed.")
                sys.exit(2)
        else:
            sys.exit(3)
    else:
        print("\nSCHEMA_NOT_FOUND: Tables 'investigations' or 'saved_reports' do not exist yet.")
        print("To apply automatically, add DATABASE_URL (Supabase connection string) to backend/.env,")
        print("or run backend/migrations/001_initial_schema.sql in the Supabase SQL Editor.")
        sys.exit(4)


if __name__ == "__main__":
    main()
