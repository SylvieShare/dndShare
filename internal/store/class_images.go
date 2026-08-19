package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

const attachSystemClassImageSQL = `
	UPDATE dndshare.item class_item
	SET icon_svg_id = NULL, icon_image_id = $1
	WHERE class_item.user_id IS NULL
	  AND class_item.type_id = 9
	  AND class_item.parent_id IS NULL
	  AND (
		class_item.icon_image_id IS NULL
		OR EXISTS (
			SELECT 1
			FROM dndshare.storage_image current_image
			WHERE current_image.id = class_item.icon_image_id
			  AND current_image."key" LIKE 'system-class-images/%'
		)
	  )
	  AND (
		regexp_replace(replace(lower(COALESCE(class_item.name_en, '')), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY($2)
		OR regexp_replace(replace(lower(class_item.name), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY($2)
	  )`

// UpsertSystemClassImage registers a stable S3 object and attaches it to the
// matching built-in base class item.
func (s *Store) UpsertSystemClassImage(ctx context.Context, key, url, fileName, mimeType string, fileSize int64, aliases []string) (int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var imageID int64
	err = tx.QueryRow(ctx, `
		SELECT id FROM dndshare.storage_image
		WHERE "key" = $1 AND user_id IS NULL
		ORDER BY id LIMIT 1 FOR UPDATE`, key).Scan(&imageID)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `
			INSERT INTO dndshare.storage_image (user_id, "key", url, "type", deleted, file_name, mime_type, file_size)
			VALUES (NULL, $1, $2, 'item_icon', false, $3, $4, $5)
			RETURNING id`, key, url, fileName, mimeType, fileSize).Scan(&imageID)
	} else if err == nil {
		_, err = tx.Exec(ctx, `
			UPDATE dndshare.storage_image
			SET url = $2, "type" = 'item_icon', deleted = false, file_name = $3, mime_type = $4, file_size = $5
			WHERE id = $1`, imageID, url, fileName, mimeType, fileSize)
	}
	if err != nil {
		return 0, err
	}

	result, err := tx.Exec(ctx, attachSystemClassImageSQL, imageID, aliases)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
