-- Medarina Healthcare Platform — Supabase PostgreSQL Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- or via psql against your project.
--
-- The schema is additive (IF NOT EXISTS) so it is safe to run more than once.

-- ============================================================
-- 1. Investigations
-- ============================================================

CREATE TABLE IF NOT EXISTS investigations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref                 TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claim               TEXT NOT NULL,
    category            TEXT NOT NULL,
    details             TEXT NOT NULL DEFAULT '',
    provider            TEXT,
    source_url          TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','review','completed','retrieving','failed')),
    sample              BOOLEAN NOT NULL DEFAULT FALSE,
    summary             TEXT,
    evidence            JSONB NOT NULL DEFAULT '[]'::jsonb,
    risk_indicators     JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendation      TEXT,
    notes               TEXT NOT NULL DEFAULT '',
    retrieval_error     TEXT,
    outcome             TEXT,
    archived            BOOLEAN NOT NULL DEFAULT FALSE,
    service_date_from   DATE,
    service_date_to     DATE,
    billing_date        DATE,
    billed_amount       NUMERIC(12,2),
    billing_codes       JSONB,
    clinical_timeline   JSONB,
    reviewer_notes      TEXT,
    retrieval           JSONB
);

-- Full-text search index
CREATE INDEX IF NOT EXISTS investigations_fts
    ON investigations
    USING gin (
        to_tsvector('english', coalesce(ref,'') || ' ' || coalesce(claim,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(provider,''))
    );

-- Common filter indexes
CREATE INDEX IF NOT EXISTS investigations_status_idx    ON investigations (status);
CREATE INDEX IF NOT EXISTS investigations_category_idx  ON investigations (category);
CREATE INDEX IF NOT EXISTS investigations_archived_idx  ON investigations (archived);
CREATE INDEX IF NOT EXISTS investigations_created_idx   ON investigations (created_at DESC);

-- ============================================================
-- 2. Saved reports
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_reports (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id  UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    review_status     TEXT NOT NULL,
    outcome           TEXT NOT NULL,
    snapshot          JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS saved_reports_investigation_idx
    ON saved_reports (investigation_id);
CREATE INDEX IF NOT EXISTS saved_reports_generated_idx
    ON saved_reports (generated_at DESC);

-- ============================================================
-- 3. Row-Level Security
-- ============================================================
-- These policies use the service-role key (bypasses RLS by default).
-- Enable RLS + JWT auth if you add user authentication to the backend.

ALTER TABLE investigations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports    ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so no policy needed for server-side access.
-- For additional safety, explicitly deny anonymous access:

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'investigations' AND policyname = 'service_role_only'
    ) THEN
        CREATE POLICY service_role_only ON investigations
            USING (current_setting('role') = 'service_role');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'saved_reports' AND policyname = 'service_role_only'
    ) THEN
        CREATE POLICY service_role_only ON saved_reports
            USING (current_setting('role') = 'service_role');
    END IF;
END $$;

-- ============================================================
-- 4. Helpful views
-- ============================================================

CREATE OR REPLACE VIEW investigation_summary AS
SELECT
    id,
    ref,
    created_at,
    claim,
    category,
    provider,
    status,
    archived,
    outcome,
    billed_amount,
    jsonb_array_length(evidence) AS evidence_count,
    jsonb_array_length(risk_indicators) AS risk_count
FROM investigations
ORDER BY created_at DESC;
