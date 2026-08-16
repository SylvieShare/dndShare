package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// ItemIconRefs contains storage rows that stopped being referenced by an item
// mutation. Callers may remove them after the transaction commits.
type ItemIconRefs struct {
	SVGID   *int64
	ImageID *int64
}

// CanEditItemIcon verifies ownership before an image body is uploaded to S3.
// SetItemIconImage repeats the check under row lock to close the race window.
func (s *Store) CanEditItemIcon(ctx context.Context, itemID, actorUserID int64, isAdmin bool) error {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT true FROM dndshare.item WHERE id = $1 AND ($2 OR user_id = $3)`,
		itemID, isAdmin, actorUserID,
	).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

// SetItemIconImage registers an uploaded S3 object and makes it the item's
// only icon. Base handbook items own system images (user_id NULL); custom items
// keep their owner's user_id even when an administrator performs the upload.
func (s *Store) SetItemIconImage(ctx context.Context, itemID, actorUserID int64, isAdmin bool, key, url, fileName, mimeType string, fileSize int64) (int64, ItemIconRefs, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, ItemIconRefs{}, err
	}
	defer tx.Rollback(ctx) // no-op after Commit

	var ownerUserID, oldSVGID, oldImageID *int64
	err = tx.QueryRow(ctx,
		`SELECT user_id, icon_svg_id, icon_image_id
		   FROM dndshare.item
		  WHERE id = $1 AND ($2 OR user_id = $3)
		  FOR UPDATE`,
		itemID, isAdmin, actorUserID,
	).Scan(&ownerUserID, &oldSVGID, &oldImageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ItemIconRefs{}, ErrNotFound
	}
	if err != nil {
		return 0, ItemIconRefs{}, err
	}

	var imageID int64
	err = tx.QueryRow(ctx,
		`INSERT INTO dndshare.storage_image (user_id, "key", url, "type", file_name, mime_type, file_size)
		 VALUES ($1, $2, $3, 'item_icon', NULLIF($4, ''), NULLIF($5, ''), $6)
		 RETURNING id`,
		ownerUserID, key, url, fileName, mimeType, fileSize,
	).Scan(&imageID)
	if err != nil {
		return 0, ItemIconRefs{}, err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE dndshare.item
		    SET icon_svg_id = NULL, icon_image_id = $1
		  WHERE id = $2`,
		imageID, itemID,
	); err != nil {
		return 0, ItemIconRefs{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, ItemIconRefs{}, err
	}
	return imageID, ItemIconRefs{SVGID: oldSVGID, ImageID: oldImageID}, nil
}

// ClearItemIcon removes either supported icon format from an item.
func (s *Store) ClearItemIcon(ctx context.Context, itemID, actorUserID int64, isAdmin bool) (ItemIconRefs, error) {
	var refs ItemIconRefs
	err := s.pool.QueryRow(ctx,
		`WITH previous AS (
		    SELECT id, icon_svg_id, icon_image_id
		      FROM dndshare.item
		     WHERE id = $1 AND ($2 OR user_id = $3)
		     FOR UPDATE
		), updated AS (
		    UPDATE dndshare.item i
		       SET icon_svg_id = NULL, icon_image_id = NULL
		      FROM previous p
		     WHERE i.id = p.id
		 RETURNING p.icon_svg_id, p.icon_image_id
		)
		SELECT icon_svg_id, icon_image_id FROM updated`,
		itemID, isAdmin, actorUserID,
	).Scan(&refs.SVGID, &refs.ImageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ItemIconRefs{}, ErrNotFound
	}
	return refs, err
}
