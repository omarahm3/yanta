-- +goose Up
CREATE VIRTUAL TABLE IF NOT EXISTS fts_journal USING fts5 (
    content,                    -- Journal entry content (indexed)
    tags,                       -- Space-separated tags (indexed)
    project_alias UNINDEXED,    -- For filtering
    date UNINDEXED,             -- YYYY-MM-DD for navigation
    entry_id UNINDEXED,         -- Entry ID for navigation
    tokenize = 'unicode61 remove_diacritics 2 tokenchars ''.-_/@#'''
);

-- +goose Down
DROP TABLE IF EXISTS fts_journal;
