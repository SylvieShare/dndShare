package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

const assignSystemRaceCoverSQL = `
	UPDATE dndshare.item
	SET cover_image_id = $1,
	    icon_image_id = CASE WHEN icon_image_id = $1 THEN NULL ELSE icon_image_id END
	WHERE user_id IS NULL
	  AND type_id = 8
	  AND (($3::boolean AND parent_id IS NOT NULL) OR (NOT $3::boolean AND parent_id IS NULL))
	  AND (cover_image_id IS NULL OR cover_image_id = $1)
	  AND (
		regexp_replace(replace(lower(COALESCE(name_en, '')), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY($2)
		OR regexp_replace(replace(lower(name), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY($2)
	  )`

// UpsertSystemRaceImage registers legacy race artwork as a cover. When the
// same row is still used as the old icon, that icon reference is cleared.
// Independently assigned icons and covers are preserved on repeated bootstrap
// syncs.
func (s *Store) UpsertSystemRaceImage(ctx context.Context, key, url, fileName, mimeType string, fileSize int64, aliases []string, subrace bool) (int64, error) {
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
			) VALUES (NULL, $1, $2, 'item_cover', false, $3, $4, $5)
			RETURNING id`, key, url, fileName, mimeType, fileSize).Scan(&imageID)
	} else if err == nil {
		_, err = tx.Exec(ctx, `
			UPDATE dndshare.storage_image
			SET url = $2, "type" = 'item_cover', deleted = false,
			    file_name = $3, mime_type = $4, file_size = $5
			WHERE id = $1`, imageID, url, fileName, mimeType, fileSize)
	}
	if err != nil {
		return 0, err
	}

	result, err := tx.Exec(ctx, assignSystemRaceCoverSQL, imageID, aliases, subrace)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
