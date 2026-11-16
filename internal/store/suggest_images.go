package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// SetSystemSuggestImage stores only the shared storage_image ID on a base
// dictionary entry. The (typeID, id) pair is its identity, not id alone.
func (s *Store) SetSystemSuggestImage(ctx context.Context, typeID, id int64, slot, key, url, fileName, mimeType string, fileSize int64) (int64, *int64, error) {
	if slot != "icon" && slot != "cover" {
		return 0, nil, fmt.Errorf("unsupported suggest image slot %q", slot)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, nil, err
	}
	defer tx.Rollback(ctx)

	var previous *int64
	err = tx.QueryRow(ctx, `SELECT `+slot+`_image_id FROM dndshare.suggest
        WHERE type_id=$1 AND id=$2 AND user_id IS NULL FOR UPDATE`, typeID, id).Scan(&previous)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil, ErrNotFound
	}
	if err != nil {
		return 0, nil, err
	}
	var imageID int64
	err = tx.QueryRow(ctx, upsertSystemItemMediaSQL, key, url, "suggest_"+slot, fileName, mimeType, fileSize).Scan(&imageID)
	if err != nil {
		return 0, nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.suggest SET `+slot+`_image_id=$1
        WHERE type_id=$2 AND id=$3 AND user_id IS NULL`, imageID, typeID, id); err != nil {
		return 0, nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return 0, nil, err
	}
	return imageID, previous, nil
}

func (s *Store) SetSystemSuggestTypeImage(ctx context.Context, typeID int64, slot, key, url, fileName, mimeType string, fileSize int64) (int64, *int64, error) {
	if slot != "icon" && slot != "cover" {
		return 0, nil, fmt.Errorf("unsupported dictionary image slot %q", slot)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, nil, err
	}
	defer tx.Rollback(ctx)
	var previous *int64
	if err = tx.QueryRow(ctx, `SELECT `+slot+`_image_id FROM dndshare.suggest_type WHERE id=$1 FOR UPDATE`, typeID).Scan(&previous); errors.Is(err, pgx.ErrNoRows) {
		return 0, nil, ErrNotFound
	} else if err != nil {
		return 0, nil, err
	}
	var imageID int64
	if err = tx.QueryRow(ctx, upsertSystemItemMediaSQL, key, url, "suggest_type_"+slot, fileName, mimeType, fileSize).Scan(&imageID); err != nil {
		return 0, nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.suggest_type SET `+slot+`_image_id=$1 WHERE id=$2`, imageID, typeID); err != nil {
		return 0, nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return 0, nil, err
	}
	return imageID, previous, nil
}
