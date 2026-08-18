package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

const upsertSystemItemMediaSQL = `
	INSERT INTO dndshare.storage_image (
		user_id, "key", url, "type", deleted, file_name, mime_type, file_size
	)
	VALUES (NULL, $1, $2, $3, false, NULLIF($4, ''), $5, $6)
	ON CONFLICT ("key") WHERE user_id IS NULL AND "key" LIKE 'system-item-media/%'
	DO UPDATE SET url = EXCLUDED.url,
	              "type" = EXCLUDED."type",
	              deleted = false,
	              file_name = EXCLUDED.file_name,
	              mime_type = EXCLUDED.mime_type,
	              file_size = EXCLUDED.file_size
	RETURNING id`

const lockSystemItemMediaTargetSQL = `
	SELECT icon_svg_id, icon_image_id, cover_image_id
	FROM dndshare.item
	WHERE id = $1 AND user_id IS NULL
	FOR UPDATE`

const setSystemItemIconSQL = `
	UPDATE dndshare.item
	SET icon_svg_id = NULL, icon_image_id = $1
	WHERE id = $2`

const setSystemItemCoverSQL = `
	UPDATE dndshare.item
	SET cover_image_id = $1
	WHERE id = $2`

// SystemItemExists performs the inexpensive pre-upload ownership check. The
// setter repeats it under a row lock after S3 succeeds.
func (s *Store) SystemItemExists(ctx context.Context, itemID int64) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `
		SELECT true
		FROM dndshare.item
		WHERE id = $1 AND user_id IS NULL`, itemID).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return exists, err
}

// SetSystemItemImage registers a content-addressed S3 object and assigns it to
// exactly one built-in item. It cannot mutate user-owned handbook content.
func (s *Store) SetSystemItemImage(ctx context.Context, itemID int64, slot, key, url, fileName, mimeType string, fileSize int64) (int64, ItemIconRefs, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, ItemIconRefs{}, err
	}
	defer tx.Rollback(ctx)

	var previous ItemIconRefs
	if err := tx.QueryRow(ctx, lockSystemItemMediaTargetSQL, itemID).Scan(
		&previous.SVGID,
		&previous.ImageID,
		&previous.CoverImageID,
	); errors.Is(err, pgx.ErrNoRows) {
		return 0, ItemIconRefs{}, ErrNotFound
	} else if err != nil {
		return 0, ItemIconRefs{}, err
	}

	mediaType := "item_" + slot
	var imageID int64
	if err := tx.QueryRow(ctx, upsertSystemItemMediaSQL,
		key, url, mediaType, fileName, mimeType, fileSize,
	).Scan(&imageID); err != nil {
		return 0, ItemIconRefs{}, err
	}

	switch slot {
	case "icon":
		if _, err := tx.Exec(ctx, setSystemItemIconSQL, imageID, itemID); err != nil {
			return 0, ItemIconRefs{}, err
		}
		previous.CoverImageID = nil
	case "cover":
		if _, err := tx.Exec(ctx, setSystemItemCoverSQL, imageID, itemID); err != nil {
			return 0, ItemIconRefs{}, err
		}
		previous.SVGID = nil
		previous.ImageID = nil
	default:
		return 0, ItemIconRefs{}, fmt.Errorf("unsupported system item image slot %q", slot)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, ItemIconRefs{}, err
	}
	return imageID, previous, nil
}
