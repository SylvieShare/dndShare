package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// SetSystemSuggestImage stores only the shared storage_image ID on a base
// dictionary entry. The (typeID, id) pair is its identity, not id alone.
func (s *Store) SetSystemSuggestImage(ctx context.Context, typeID, id int64, key, url, fileName, mimeType string, fileSize int64) (int64, *int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, nil, err
	}
	defer tx.Rollback(ctx)

	var previous *int64
	err = tx.QueryRow(ctx, `SELECT icon_image_id FROM dndshare.suggest
        WHERE type_id=$1 AND id=$2 AND user_id IS NULL FOR UPDATE`, typeID, id).Scan(&previous)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil, ErrNotFound
	}
	if err != nil {
		return 0, nil, err
	}
	var imageID int64
	err = tx.QueryRow(ctx, upsertSystemItemMediaSQL, key, url, "suggest_icon", fileName, mimeType, fileSize).Scan(&imageID)
	if err != nil {
		return 0, nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.suggest SET icon_image_id=$1
        WHERE type_id=$2 AND id=$3 AND user_id IS NULL`, imageID, typeID, id); err != nil {
		return 0, nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return 0, nil, err
	}
	return imageID, previous, nil
}
