package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

const systemRaceIconItemsSQL = `
	SELECT id, icon_image_id
	FROM dndshare.item
	WHERE user_id IS NULL
	  AND type_id = 8
	  AND (($2::boolean AND parent_id IS NOT NULL) OR (NOT $2::boolean AND parent_id IS NULL))
	  AND (
		regexp_replace(replace(lower(COALESCE(name_en, '')), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY($1)
		OR regexp_replace(replace(lower(name), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY($1)
	  )
	FOR UPDATE`

const retireRaceIconImageSQL = `
	UPDATE dndshare.storage_image img
	SET deleted = true, "type" = 'retired_race_icon'
	WHERE img.id = $1
	  AND img.deleted = false
	  AND img.user_id IS NULL
	  AND NOT EXISTS (SELECT 1 FROM dndshare.item i WHERE i.icon_image_id = img.id)
	  AND NOT EXISTS (SELECT 1 FROM dndshare.item i WHERE i.cover_image_id = img.id)
	  AND NOT EXISTS (SELECT 1 FROM dndshare.session_image_catalog catalog WHERE catalog.image_id = img.id)
	  AND NOT EXISTS (SELECT 1 FROM dndshare.session_chapter chapter WHERE chapter.image_id = img.id)
	  AND NOT EXISTS (SELECT 1 FROM dndshare.session_scene scene WHERE scene.image_id = img.id)
	  AND NOT EXISTS (SELECT 1 FROM dndshare.session_material material WHERE material.asset_id = img.id)
	  AND NOT EXISTS (SELECT 1 FROM dndshare.session_location location WHERE location.image_id = img.id)
	  AND NOT EXISTS (SELECT 1 FROM dndshare.session_npc npc WHERE npc.image_id = img.id)`

// UpsertSystemRaceIcon registers a stable transparent WebP and assigns it to
// one matching built-in base race or subrace. A replaced illustration remains
// active when the same storage row is still used as that race's cover.
func (s *Store) UpsertSystemRaceIcon(ctx context.Context, key, url, fileName, mimeType string, fileSize int64, aliases []string, subrace bool) (int64, error) {
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

	rows, err := tx.Query(ctx, systemRaceIconItemsSQL, aliases, subrace)
	if err != nil {
		return 0, err
	}
	itemIDs := []int64{}
	oldImageIDs := map[int64]struct{}{}
	for rows.Next() {
		var itemID int64
		var oldImageID *int64
		if err := rows.Scan(&itemID, &oldImageID); err != nil {
			rows.Close()
			return 0, err
		}
		itemIDs = append(itemIDs, itemID)
		if oldImageID != nil && *oldImageID != imageID {
			oldImageIDs[*oldImageID] = struct{}{}
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return 0, err
	}
	rows.Close()

	if len(itemIDs) > 0 {
		if _, err := tx.Exec(ctx, `
			UPDATE dndshare.item
			SET icon_svg_id = NULL, icon_image_id = $1
			WHERE id = ANY($2::bigint[])`, imageID, itemIDs); err != nil {
			return 0, err
		}
	}
	for oldImageID := range oldImageIDs {
		if _, err := tx.Exec(ctx, retireRaceIconImageSQL, oldImageID); err != nil {
			return 0, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return int64(len(itemIDs)), nil
}

func (s *Store) ListRetiredRaceIconKeys(ctx context.Context) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT "key"
		FROM dndshare.storage_image
		WHERE "type" = 'retired_race_icon' AND deleted = true AND "key" IS NOT NULL
		ORDER BY "key"`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	keys := []string{}
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}
	return keys, rows.Err()
}
