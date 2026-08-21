package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

const characterIconWriteAccessSQL = `SELECT character.user_id, character.icon_image_id
   FROM dndshare."char" character
  WHERE character.id = $1
    AND character.deleted = false
    AND (
      character.user_id = $2
      OR EXISTS (
        SELECT 1
          FROM dndshare.session_participant participant
          JOIN dndshare."session" session
            ON session.id = participant.session_id
           AND session.deleted = false
         WHERE participant.char_id = character.id
           AND session.owner_user_id = $2
      )
    )
  FOR UPDATE`

// SetCharacterIconImage registers an uploaded object and atomically assigns it
// when the actor owns the character or is the GM of its session. The previous
// image is returned for post-commit cleanup.
func (s *Store) SetCharacterIconImage(ctx context.Context, charID, actorUserID int64, key, url, fileName, mimeType string, fileSize int64) (int64, *int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, nil, err
	}
	defer tx.Rollback(ctx)

	var ownerUserID int64
	var oldImageID *int64
	err = tx.QueryRow(ctx, characterIconWriteAccessSQL, charID, actorUserID).Scan(&ownerUserID, &oldImageID)
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
		ownerUserID, key, url, fileName, mimeType, fileSize,
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
