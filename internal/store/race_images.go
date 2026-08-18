package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// UpsertSystemRaceImage registers a stable S3 object in storage_image and
// attaches it to every matching built-in base-race item.
func (s *Store) UpsertSystemRaceImage(ctx context.Context, key, url, fileName, mimeType string, fileSize int64, aliases []string) (int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var imageID int64
	err = tx.QueryRow(ctx, `
		SELECT id
		FROM dndshare.storage_image
		WHERE "key" = $1 AND user_id IS NULL
		ORDER BY id
		LIMIT 1
		FOR UPDATE`, key).Scan(&imageID)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `
			INSERT INTO dndshare.storage_image (
				user_id, "key", url, "type", deleted, file_name, mime_type, file_size
			) VALUES (NULL, $1, $2, 'item_icon', false, $3, $4, $5)
			RETURNING id`, key, url, fileName, mimeType, fileSize).Scan(&imageID)
	} else if err == nil {
		_, err = tx.Exec(ctx, `
			UPDATE dndshare.storage_image
			SET url = $2, "type" = 'item_icon', deleted = false,
			    file_name = $3, mime_type = $4, file_size = $5
			WHERE id = $1`, imageID, url, fileName, mimeType, fileSize)
	}
	if err != nil {
		return 0, err
	}

	result, err := tx.Exec(ctx, `
		UPDATE dndshare.item
		SET icon_svg_id = NULL, icon_image_id = $1
		WHERE user_id IS NULL
		  AND parent_id IS NULL
		  AND type_id = 8
		  AND (
			regexp_replace(replace(lower(COALESCE(name_en, '')), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY($2)
			OR regexp_replace(replace(lower(name), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY($2)
		  )`, imageID, aliases)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
