-- +goose Up
-- Add kind column to doc table to distinguish between document and canvas types

ALTER TABLE doc ADD COLUMN kind TEXT NOT NULL DEFAULT 'document';

CREATE INDEX IF NOT EXISTS idx_doc_kind ON doc (kind)
WHERE
    deleted_at IS NULL;

-- Update schema version
UPDATE kv SET value = '3' WHERE key = 'schema_version';

-- +goose Down
DROP INDEX IF EXISTS idx_doc_kind;

ALTER TABLE doc DROP COLUMN kind;

-- Revert schema version
UPDATE kv SET value = '2' WHERE key = 'schema_version';
