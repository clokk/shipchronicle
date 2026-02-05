-- Bulk upsert sessions via SECURITY DEFINER to bypass per-row RLS
-- Same pattern as bulk_upsert_turns — validates commit ownership once per batch
CREATE OR REPLACE FUNCTION bulk_upsert_sessions(p_sessions JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count INTEGER;
  calling_user_id UUID;
BEGIN
  calling_user_id := auth.uid();

  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate all commit_ids belong to user (single check)
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_sessions) AS s
    LEFT JOIN cognitive_commits c ON c.id = (s->>'commit_id')::UUID
    WHERE c.user_id IS DISTINCT FROM calling_user_id
       OR c.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unauthorized: sessions reference commits not owned by user';
  END IF;

  -- Bulk upsert (no per-row RLS check)
  INSERT INTO sessions (id, commit_id, started_at, ended_at, version, updated_at)
  SELECT
    (s->>'id')::UUID,
    (s->>'commit_id')::UUID,
    (s->>'started_at')::TIMESTAMPTZ,
    (s->>'ended_at')::TIMESTAMPTZ,
    COALESCE((s->>'version')::INTEGER, 1),
    (s->>'updated_at')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_sessions) AS s
  ON CONFLICT (id) DO UPDATE SET
    started_at = EXCLUDED.started_at,
    ended_at = EXCLUDED.ended_at,
    version = EXCLUDED.version,
    updated_at = EXCLUDED.updated_at;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;
