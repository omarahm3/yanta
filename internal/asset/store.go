package asset

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type queryer interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Upsert(ctx context.Context, asset *Asset) (bool, error) {
	return s.UpsertTx(ctx, s.db, asset)
}

func (s *Store) UpsertTx(ctx context.Context, q queryer, asset *Asset) (bool, error) {
	if err := asset.Validate(); err != nil {
		return false, fmt.Errorf("validation failed: %w", err)
	}

	var exists bool
	checkSQL := `SELECT 1 FROM asset WHERE hash = ?`
	err := q.QueryRowContext(ctx, checkSQL, asset.Hash).Scan(&exists)
	if err != nil && err != sql.ErrNoRows {
		return false, fmt.Errorf("checking asset existence: %w", err)
	}

	if exists {
		updateSQL := `
			UPDATE asset
			SET ext = ?, bytes = ?, mime = ?
			WHERE hash = ?
		`
		_, err = q.ExecContext(ctx, updateSQL, asset.Ext, asset.Bytes, asset.MIME, asset.Hash)
		if err != nil {
			return false, fmt.Errorf("updating asset: %w", err)
		}
		return true, nil
	}

	insertSQL := `
		INSERT INTO asset (hash, ext, bytes, mime, created_at)
		VALUES (?, ?, ?, ?, ?)
	`
	_, err = q.ExecContext(ctx, insertSQL,
		asset.Hash,
		asset.Ext,
		asset.Bytes,
		asset.MIME,
		asset.CreatedAt.Format(time.RFC3339Nano),
	)
	if err != nil {
		return false, fmt.Errorf("inserting asset: %w", err)
	}

	return false, nil
}

func (s *Store) GetByHash(ctx context.Context, hash string) (*Asset, error) {
	return s.GetByHashTx(ctx, s.db, hash)
}

func (s *Store) GetByHashTx(ctx context.Context, q queryer, hash string) (*Asset, error) {
	if err := ValidateHash(hash); err != nil {
		return nil, fmt.Errorf("invalid hash: %w", err)
	}

	query := `
		SELECT hash, ext, bytes, mime, created_at
		FROM asset
		WHERE hash = ?
	`

	var a Asset
	var createdStr string

	err := q.QueryRowContext(ctx, query, hash).Scan(
		&a.Hash,
		&a.Ext,
		&a.Bytes,
		&a.MIME,
		&createdStr,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("asset not found: %s", hash)
	}
	if err != nil {
		return nil, fmt.Errorf("querying asset: %w", err)
	}

	a.CreatedAt, err = time.Parse(time.RFC3339Nano, createdStr)
	if err != nil {
		return nil, fmt.Errorf("parsing created_at: %w", err)
	}

	return &a, nil
}

func (s *Store) Delete(ctx context.Context, hash string) error {
	return s.DeleteTx(ctx, s.db, hash)
}

func (s *Store) DeleteTx(ctx context.Context, q queryer, hash string) error {
	if err := ValidateHash(hash); err != nil {
		return fmt.Errorf("invalid hash: %w", err)
	}

	query := `DELETE FROM asset WHERE hash = ?`
	result, err := q.ExecContext(ctx, query, hash)
	if err != nil {
		return fmt.Errorf("deleting asset: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("asset not found: %s", hash)
	}

	return nil
}

func (s *Store) LinkToDocument(ctx context.Context, hash, docPath string) error {
	return s.LinkToDocumentTx(ctx, s.db, hash, docPath)
}

func (s *Store) LinkToDocumentTx(ctx context.Context, q queryer, hash, docPath string) error {
	if err := ValidateHash(hash); err != nil {
		return fmt.Errorf("invalid hash: %w", err)
	}

	if docPath == "" {
		return fmt.Errorf("document path cannot be empty")
	}

	query := `
		INSERT INTO doc_asset (path, hash)
		VALUES (?, ?)
		ON CONFLICT DO NOTHING
	`

	_, err := q.ExecContext(ctx, query, docPath, hash)
	if err != nil {
		return fmt.Errorf("linking asset to document: %w", err)
	}

	return nil
}

func (s *Store) UnlinkFromDocument(ctx context.Context, hash, docPath string) error {
	return s.UnlinkFromDocumentTx(ctx, s.db, hash, docPath)
}

func (s *Store) UnlinkFromDocumentTx(ctx context.Context, q queryer, hash, docPath string) error {
	if err := ValidateHash(hash); err != nil {
		return fmt.Errorf("invalid hash: %w", err)
	}

	if docPath == "" {
		return fmt.Errorf("document path cannot be empty")
	}

	query := `DELETE FROM doc_asset WHERE path = ? AND hash = ?`
	result, err := q.ExecContext(ctx, query, docPath, hash)
	if err != nil {
		return fmt.Errorf("unlinking asset from document: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("link not found: doc=%s hash=%s", docPath, hash)
	}

	return nil
}

func (s *Store) GetDocumentAssets(ctx context.Context, docPath string) ([]*Asset, error) {
	return s.GetDocumentAssetsTx(ctx, s.db, docPath)
}

func (s *Store) GetDocumentAssetsTx(ctx context.Context, q queryer, docPath string) ([]*Asset, error) {
	if docPath == "" {
		return nil, fmt.Errorf("document path cannot be empty")
	}

	query := `
		SELECT a.hash, a.ext, a.bytes, a.mime, a.created_at
		FROM asset a
		JOIN doc_asset da ON a.hash = da.hash
		WHERE da.path = ?
		ORDER BY a.created_at DESC
	`

	rows, err := q.QueryContext(ctx, query, docPath)
	if err != nil {
		return nil, fmt.Errorf("querying document assets: %w", err)
	}
	defer rows.Close()

	var assets []*Asset

	for rows.Next() {
		var a Asset
		var createdStr string

		err := rows.Scan(&a.Hash, &a.Ext, &a.Bytes, &a.MIME, &createdStr)
		if err != nil {
			return nil, fmt.Errorf("scanning asset row: %w", err)
		}

		a.CreatedAt, err = time.Parse(time.RFC3339Nano, createdStr)
		if err != nil {
			return nil, fmt.Errorf("parsing created_at: %w", err)
		}

		assets = append(assets, &a)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating asset rows: %w", err)
	}

	return assets, nil
}

func (s *Store) GetOrphanedAssets(ctx context.Context) ([]*Asset, error) {
	return s.GetOrphanedAssetsTx(ctx, s.db)
}

func (s *Store) GetOrphanedAssetsTx(ctx context.Context, q queryer) ([]*Asset, error) {
	query := `
		SELECT a.hash, a.ext, a.bytes, a.mime, a.created_at
		FROM asset a
		WHERE NOT EXISTS (
			SELECT 1 FROM doc_asset da WHERE da.hash = a.hash
		)
		ORDER BY a.created_at DESC
	`

	rows, err := q.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("querying orphaned assets: %w", err)
	}
	defer rows.Close()

	var assets []*Asset

	for rows.Next() {
		var a Asset
		var createdStr string

		err := rows.Scan(&a.Hash, &a.Ext, &a.Bytes, &a.MIME, &createdStr)
		if err != nil {
			return nil, fmt.Errorf("scanning asset row: %w", err)
		}

		a.CreatedAt, err = time.Parse(time.RFC3339Nano, createdStr)
		if err != nil {
			return nil, fmt.Errorf("parsing created_at: %w", err)
		}

		assets = append(assets, &a)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating asset rows: %w", err)
	}

	return assets, nil
}

func (s *Store) UnlinkAllFromDocument(ctx context.Context, docPath string) error {
	return s.UnlinkAllFromDocumentTx(ctx, s.db, docPath)
}

func (s *Store) UnlinkAllFromDocumentTx(ctx context.Context, q queryer, docPath string) error {
	if docPath == "" {
		return fmt.Errorf("document path cannot be empty")
	}

	query := `DELETE FROM doc_asset WHERE path = ?`
	_, err := q.ExecContext(ctx, query, docPath)
	if err != nil {
		return fmt.Errorf("unlinking all assets from document: %w", err)
	}

	return nil
}
