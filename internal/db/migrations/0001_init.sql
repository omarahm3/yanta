-- +goose Up
-- Schema: YANTA v2 Database (SQLite + FTS5)

-- ===== KEY-VALUE STORE (Schema Versioning) =====
CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO kv (key, value) VALUES ('schema_version', '2');

INSERT INTO
    kv (key, value)
VALUES (
        'created_at',
        strftime('%Y-%m-%d %H:%M:%f', 'now')
    );

INSERT INTO
    kv (key, value)
VALUES (
        'last_reindex',
        strftime('%Y-%m-%d %H:%M:%f', 'now')
    );

-- ===== PROJECTS =====
CREATE TABLE IF NOT EXISTS project (
    id TEXT PRIMARY KEY,
    alias TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL DEFAULT (
        strftime('%Y-%m-%d %H:%M:%f', 'now')
    ),
    end_date TEXT,
    created_at TEXT NOT NULL DEFAULT (
        strftime('%Y-%m-%d %H:%M:%f', 'now')
    ),
    updated_at TEXT NOT NULL DEFAULT (
        strftime('%Y-%m-%d %H:%M:%f', 'now')
    ),
    deleted_at TEXT,
    CHECK (alias GLOB '@[a-z0-9-]*'),
    CHECK (
        length(alias) >= 3
        AND length(alias) <= 33
    )
);

CREATE INDEX IF NOT EXISTS idx_project_alias ON project (alias)
WHERE
    deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_active ON project (deleted_at)
WHERE
    deleted_at IS NULL;

-- +goose StatementBegin
CREATE TRIGGER IF NOT EXISTS project_touch_upd
AFTER UPDATE ON project
WHEN OLD.updated_at IS NEW.updated_at
BEGIN
  UPDATE project
  SET updated_at = strftime('%Y-%m-%d %H:%M:%f','now')
  WHERE id = NEW.id;
END;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TRIGGER IF NOT EXISTS project_alias_cascade
AFTER UPDATE OF alias ON project
BEGIN
  UPDATE doc SET project_alias = NEW.alias WHERE project_alias = OLD.alias;
END;
-- +goose StatementEnd

-- ===== DOCUMENTS (Index Only) =====
CREATE TABLE IF NOT EXISTS doc (
    path TEXT PRIMARY KEY,
    project_alias TEXT NOT NULL,
    title TEXT,
    mtime_ns INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (
        strftime('%Y-%m-%d %H:%M:%f', 'now')
    ),
    updated_at TEXT NOT NULL DEFAULT (
        strftime('%Y-%m-%d %H:%M:%f', 'now')
    ),
    has_code INTEGER NOT NULL DEFAULT 0,
    has_images INTEGER NOT NULL DEFAULT 0,
    has_links INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    FOREIGN KEY (project_alias) REFERENCES project (alias) ON UPDATE CASCADE,
    CHECK (path NOT LIKE '%..%'),
    CHECK (has_code IN (0, 1)),
    CHECK (has_images IN (0, 1)),
    CHECK (has_links IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_doc_project ON doc (project_alias)
WHERE
    deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_doc_mtime ON doc (mtime_ns DESC)
WHERE
    deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_doc_updated ON doc (updated_at DESC)
WHERE
    deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_doc_has_code ON doc (has_code)
WHERE
    has_code = 1
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_doc_has_images ON doc (has_images)
WHERE
    has_images = 1
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_doc_has_links ON doc (has_links)
WHERE
    has_links = 1
    AND deleted_at IS NULL;

-- ===== TAGS =====
CREATE TABLE IF NOT EXISTS tag (
    name TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (
        strftime('%Y-%m-%d %H:%M:%f', 'now')
    ),
    updated_at TEXT NOT NULL DEFAULT (
        strftime('%Y-%m-%d %H:%M:%f', 'now')
    ),
    deleted_at TEXT,
    CHECK (name = lower(name)),
    CHECK (name GLOB '[a-z0-9_-]*'),
    CHECK (
        length(name) >= 1
        AND length(name) <= 64
    )
);

CREATE INDEX IF NOT EXISTS idx_tag_active ON tag (name)
WHERE
    deleted_at IS NULL;

-- +goose StatementBegin
CREATE TRIGGER IF NOT EXISTS tag_touch_upd
AFTER UPDATE ON tag
WHEN OLD.updated_at IS NEW.updated_at
BEGIN
  UPDATE tag
  SET updated_at = strftime('%Y-%m-%d %H:%M:%f','now')
  WHERE name = NEW.name;
END;
-- +goose StatementEnd

-- ===== DOCUMENT <-> TAG =====
CREATE TABLE IF NOT EXISTS doc_tag (
    path TEXT NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY (path, tag),
    FOREIGN KEY (path) REFERENCES doc (path) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (tag) REFERENCES tag (name) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_doc_tag_tag ON doc_tag (tag);

CREATE INDEX IF NOT EXISTS idx_doc_tag_path ON doc_tag (path);

-- ===== LINKS =====
CREATE TABLE IF NOT EXISTS doc_link (
    path TEXT NOT NULL,
    url TEXT NOT NULL,
    host TEXT NOT NULL,
    PRIMARY KEY (path, url),
    FOREIGN KEY (path) REFERENCES doc (path) ON UPDATE CASCADE ON DELETE CASCADE,
    CHECK (length(url) <= 2048)
);

CREATE INDEX IF NOT EXISTS idx_doc_link_host ON doc_link (host);

CREATE INDEX IF NOT EXISTS idx_doc_link_path ON doc_link (path);

-- ===== ASSETS =====
CREATE TABLE IF NOT EXISTS asset (
    hash TEXT PRIMARY KEY,
    ext TEXT,
    bytes INTEGER NOT NULL,
    mime TEXT,
    created_at TEXT NOT NULL DEFAULT (
        strftime('%Y-%m-%d %H:%M:%f', 'now')
    ),
    CHECK (length(hash) = 64),
    CHECK (hash GLOB '[0-9a-f]*'),
    CHECK (bytes > 0)
);

CREATE INDEX IF NOT EXISTS idx_asset_mime ON asset (mime);

CREATE INDEX IF NOT EXISTS idx_asset_created ON asset (created_at DESC);

-- ===== DOCUMENT <-> ASSET =====
CREATE TABLE IF NOT EXISTS doc_asset (
    path TEXT NOT NULL,
    hash TEXT NOT NULL,
    PRIMARY KEY (path, hash),
    FOREIGN KEY (path) REFERENCES doc (path) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (hash) REFERENCES asset (hash) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_doc_asset_hash ON doc_asset (hash);

CREATE INDEX IF NOT EXISTS idx_doc_asset_path ON doc_asset (path);

-- ===== FTS5 (Full-Text Search) =====
CREATE VIRTUAL TABLE IF NOT EXISTS fts_doc USING fts5 (
    title,
    headings,
    body,
    code,
    path UNINDEXED,
    tokenize = 'unicode61 remove_diacritics 2 tokenchars ''.-_/@#'''
);

-- ===== VIEWS =====
CREATE VIEW IF NOT EXISTS v_tag_stats AS
SELECT t.name, COUNT(dt.path) AS doc_count, MAX(d.updated_at) AS last_used
FROM
    tag t
    LEFT JOIN doc_tag dt ON t.name = dt.tag
    LEFT JOIN doc d ON dt.path = d.path
    AND d.deleted_at IS NULL
WHERE
    t.deleted_at IS NULL
GROUP BY
    t.name;

CREATE VIEW IF NOT EXISTS v_project_doc_counts AS
SELECT
    p.id,
    p.alias,
    p.name,
    COUNT(d.path) AS doc_count,
    MAX(d.updated_at) AS last_updated
FROM project p
    LEFT JOIN doc d ON p.alias = d.project_alias
    AND d.deleted_at IS NULL
WHERE
    p.deleted_at IS NULL
GROUP BY
    p.id;

-- +goose Down
DROP VIEW IF EXISTS v_project_doc_counts;

DROP VIEW IF EXISTS v_tag_stats;

DROP TABLE IF EXISTS fts_doc;

DROP TABLE IF EXISTS doc_asset;

DROP TABLE IF EXISTS asset;

DROP TABLE IF EXISTS doc_link;

DROP TABLE IF EXISTS doc_tag;

DROP TABLE IF EXISTS tag;

DROP TABLE IF EXISTS doc;

DROP TRIGGER IF EXISTS project_alias_cascade;

DROP TRIGGER IF EXISTS project_touch_upd;

DROP TRIGGER IF EXISTS tag_touch_upd;

DROP TABLE IF EXISTS project;

DROP TABLE IF EXISTS kv;
