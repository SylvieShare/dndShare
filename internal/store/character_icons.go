package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// SetCharacterIconImage registers an uploaded object and atomically assigns it
// to an owned character. The previous image is returned for post-commit cleanup.
func (s *Store) SetCharacterIconImage(ctx context.Context, charID, userID int64, key, url, fileName, mimeType string, fileSize int64) (int64, *int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, nil, err
	}
	defer tx.Rollback(ctx)

	var oldImageID *int64
	err = tx.QueryRow(ctx,
		`SELECT icon_image_id
		   FROM dndshare."char"
		  WHERE id = $1 AND user_id = $2 AND deleted = false
		  FOR UPDATE`,
		charID, userID,
	).Scan(&oldImageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil, ErrNotFound
	}
	if err != nil {
		return 0, nil, err
	}

	var imageID int64
	err = tx.QueryRow(ctx,
		`INSERT INTO dndshare.storage_image (user_id, "key", url, "type", file_name, mime_type, file_size)
		 VALUES ($1, $2, $3, 'image', NULLIF($4, ''), NULLIF($5, ''), $6)
		 RETURNING id`,
		userID, key, url, fileName, mimeType, fileSize,
	).Scan(&imageID)
	if err != nil {
		return 0, nil, err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE dndshare."char"
		    SET icon_image_id = $1, changed_at = now()
		  WHERE id = $2`,
		imageID, charID,
	); err != nil {
		return 0, nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, nil, err
	}
	return imageID, oldImageID, nil
}
