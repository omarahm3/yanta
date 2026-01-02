-- +goose Up
-- Add key for storing the last auto-sync timestamp
INSERT OR IGNORE INTO kv (key, value) VALUES ('last_auto_sync', '');

-- +goose Down
DELETE FROM kv WHERE key = 'last_auto_sync';
