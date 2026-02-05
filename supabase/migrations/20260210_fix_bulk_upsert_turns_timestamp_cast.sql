-- Fix: cast timestamp text to TIMESTAMPTZ (column type is timestamp with time zone)
CREATE OR REPLACE FUNCTION bulk_upsert_turns(p_turns JSONB)
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

  -- Validate all session_ids belong to user's commits (single check)
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_turns) AS t
    LEFT JOIN sessions s ON s.id = (t->>'session_id')::UUID
    LEFT JOIN cognitive_commits c ON c.id = s.commit_id
    WHERE c.user_id IS DISTINCT FROM calling_user_id
       OR c.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unauthorized: turns reference sessions not owned by user';
  END IF;

  -- Bulk upsert (no per-row RLS check)
  INSERT INTO turns (
    id, session_id, role, content, timestamp, tool_calls,
    triggers_visual, model, has_rejection, has_approval,
    is_question, has_code_block, char_count, version, updated_at
  )
  SELECT
    (t->>'id')::UUID,
    (t->>'session_id')::UUID,
    (t->>'role'),
    (t->>'content'),
    (t->>'timestamp')::TIMESTAMPTZ,
    (t->>'tool_calls')::JSONB,
    COALESCE((t->>'triggers_visual')::BOOLEAN, FALSE),
    (t->>'model'),
    COALESCE((t->>'has_rejection')::BOOLEAN, FALSE),
    COALESCE((t->>'has_approval')::BOOLEAN, FALSE),
    COALESCE((t->>'is_question')::BOOLEAN, FALSE),
    COALESCE((t->>'has_code_block')::BOOLEAN, FALSE),
    COALESCE((t->>'char_count')::INTEGER, 0),
    COALESCE((t->>'version')::INTEGER, 1),
    (t->>'updated_at')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_turns) AS t
  ON CONFLICT (id) DO UPDATE SET
    content = EXCLUDED.content,
    tool_calls = EXCLUDED.tool_calls,
    triggers_visual = EXCLUDED.triggers_visual,
    has_rejection = EXCLUDED.has_rejection,
    has_approval = EXCLUDED.has_approval,
    is_question = EXCLUDED.is_question,
    has_code_block = EXCLUDED.has_code_block,
    char_count = EXCLUDED.char_count,
    version = EXCLUDED.version,
    updated_at = EXCLUDED.updated_at;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;
