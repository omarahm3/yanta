-- +goose Up
-- Add keys for storing backup configuration
INSERT OR IGNORE INTO kv (key, value) VALUES ('backup_enabled', 'true');
INSERT OR IGNORE INTO kv (key, value) VALUES ('backup_max_backups', '10');

-- +goose Down
DELETE FROM kv WHERE key = 'backup_enabled';
DELETE FROM kv WHERE key = 'backup_max_backups';
