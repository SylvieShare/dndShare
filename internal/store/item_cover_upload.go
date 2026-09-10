package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// SetItemCoverImage registers an uploaded S3 object and makes it the item's
// cover. Base handbook items own system images (user_id NULL); custom items
// keep their owner's user_id even when an administrator performs the upload.
func (s *Store) SetItemCoverImage(ctx context.Context, itemID, actorUserID int64, isAdmin bool, key, url, fileName, mimeType string, fileSize int64) (int64, ItemIconRefs, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, ItemIconRefs{}, err
	}
	defer tx.Rollback(ctx) // no-op after Commit

	var ownerUserID, oldImageID *int64
	err = tx.QueryRow(ctx,
		`SELECT user_id, cover_image_id
		   FROM dndshare.item
		  WHERE id = $1 AND ($2 OR user_id = $3)
		  FOR UPDATE`,
		itemID, isAdmin, actorUserID,
	).Scan(&ownerUserID, &oldImageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ItemIconRefs{}, ErrNotFound
	}
	if err != nil {
		return 0, ItemIconRefs{}, err
	}

	var imageID int64
	err = tx.QueryRow(ctx,
		`INSERT INTO dndshare.storage_image (user_id, "key", url, "type", file_name, mime_type, file_size)
		 VALUES ($1, $2, $3, 'item_cover', NULLIF($4, ''), NULLIF($5, ''), $6)
		 RETURNING id`,
		ownerUserID, key, url, fileName, mimeType, fileSize,
	).Scan(&imageID)
	if err != nil {
		return 0, ItemIconRefs{}, err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE dndshare.item
		    SET cover_image_id = $1
		  WHERE id = $2`,
		imageID, itemID,
	); err != nil {
		return 0, ItemIconRefs{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, ItemIconRefs{}, err
	}
	return imageID, ItemIconRefs{CoverImageID: oldImageID}, nil
}

// ClearItemCover removes the cover from an item.
func (s *Store) ClearItemCover(ctx context.Context, itemID, actorUserID int64, isAdmin bool) (ItemIconRefs, error) {
	var refs ItemIconRefs
	err := s.pool.QueryRow(ctx,
		`WITH previous AS (
		    SELECT id, cover_image_id
		      FROM dndshare.item
		     WHERE id = $1 AND ($2 OR user_id = $3)
		     FOR UPDATE
		), updated AS (
		    UPDATE dndshare.item i
		       SET cover_image_id = NULL
		      FROM previous p
		     WHERE i.id = p.id
		 RETURNING p.cover_image_id
		)
		SELECT cover_image_id FROM updated`,
		itemID, isAdmin, actorUserID,
	).Scan(&refs.CoverImageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ItemIconRefs{}, ErrNotFound
	}
	return refs, err
}
