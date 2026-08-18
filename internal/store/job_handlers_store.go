package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

// Store operations used by registered background jobs.

// --- recount ---

// RecountItemTypes пересчитывает count_items у item_type.
func (s *Store) RecountItemTypes(ctx context.Context) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.item_type it
		 SET count_items = (SELECT COUNT(*) FROM dndshare.item i WHERE i.type_id = it.id)`,
	)
	return err
}

// RecountSources пересчитывает count_items у source.
func (s *Store) RecountSources(ctx context.Context) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.source s
		 SET count_items = (SELECT COALESCE(SUM(it.count_items), 0) FROM dndshare.item_type it WHERE it.source_id = s.id)`,
	)
	return err
}

// RecountSuggestTypes пересчитывает count_items у suggest_type.
func (s *Store) RecountSuggestTypes(ctx context.Context) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.suggest_type st
		 SET count_items = (SELECT COUNT(*) FROM dndshare.suggest s WHERE s.type_id = st.id)`,
	)
	return err
}

// --- bestiary import ---

// BestiaryFindItemByNameEn — есть ли базовый предмет типа с таким name_en (без регистра).
func (s *Store) BestiaryFindItemByNameEn(ctx context.Context, typeID int64, nameEn string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM dndshare.item WHERE type_id = $1 AND user_id IS NULL AND lower(name_en) = lower($2))`,
		typeID, nameEn,
	).Scan(&exists)
	return exists, err
}

// BestiaryUpdateItem обновляет базовый предмет и его S3-изображение.
func (s *Store) BestiaryUpdateItem(ctx context.Context, nameEn, name string, data json.RawMessage, imageKey, imageURL, sourceCode, sourceName string, typeID int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) // no-op after Commit

	var itemID int64
	err = tx.QueryRow(ctx,
		`UPDATE dndshare.item SET name = $1, data = CAST($2 AS jsonb)
		 WHERE lower(name_en) = lower($3) AND type_id = $4 AND user_id IS NULL
		 RETURNING id`,
		name, string(data), nameEn, typeID,
	).Scan(&itemID)
	if err != nil {
		return err
	}
	if err := setBestiaryItemImage(ctx, tx, itemID, imageKey, imageURL); err != nil {
		return err
	}
	if err := setBestiaryItemContentSource(ctx, tx, itemID, typeID, sourceCode, sourceName); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// BestiaryCreateItem создаёт базовый предмет (user_id NULL) и возвращает id.
func (s *Store) BestiaryCreateItem(ctx context.Context, name, nameEn string, data json.RawMessage, imageKey, imageURL, sourceCode, sourceName string, typeID int64) (int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx) // no-op after Commit

	var id int64
	err = tx.QueryRow(ctx,
		`INSERT INTO dndshare.item (user_id, name, name_en, data, type_id, parent_id)
		 VALUES (NULL, $1, $2, CAST($3 AS jsonb), $4, NULL) RETURNING id`,
		name, nameEn, string(data), typeID,
	).Scan(&id)
	if err != nil {
		return 0, err
	}
	if err := setBestiaryItemImage(ctx, tx, id, imageKey, imageURL); err != nil {
		return 0, err
	}
	if err := setBestiaryItemContentSource(ctx, tx, id, typeID, sourceCode, sourceName); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return id, nil
}

// setBestiaryItemContentSource projects the upstream publication metadata into
// the relational source model used by catalogue filtering. Imported creatures
// have exactly one authoritative publication; a repeated import replaces a
// stale link if the upstream catalogue corrects it.
func setBestiaryItemContentSource(ctx context.Context, tx pgx.Tx, itemID, typeID int64, sourceCode, sourceName string) error {
	sourceCode = strings.ToUpper(strings.TrimSpace(sourceCode))
	sourceName = strings.TrimSpace(sourceName)
	if sourceName == "" {
		sourceName = sourceCode
	}
	if sourceCode == "" {
		_, err := tx.Exec(ctx, `DELETE FROM dndshare.item_content_source WHERE item_id = $1`, itemID)
		return err
	}

	var contentSourceID, sourceVersionID int64
	err := tx.QueryRow(ctx, `
		WITH source_context AS (
			SELECT it.source_id, sv.id AS source_version_id
			FROM dndshare.item_type it
			JOIN dndshare.source_version sv ON sv.source_id = it.source_id
			WHERE it.id = $1
			ORDER BY (lower(sv.version) = '2014') DESC, sv.id
			LIMIT 1
		), inserted AS (
			INSERT INTO dndshare.content_source (
				source_id, native_source_version_id, name, code, kind, is_default, sort_order
			)
			SELECT source_id, source_version_id, $3, $2, 'addon', false, 100
			FROM source_context
			ON CONFLICT DO NOTHING
			RETURNING id, native_source_version_id
		)
		SELECT id, native_source_version_id FROM inserted
		UNION ALL
		SELECT cs.id, cs.native_source_version_id
		FROM dndshare.content_source cs
		JOIN source_context sc
		  ON sc.source_id = cs.source_id
		 AND sc.source_version_id = cs.native_source_version_id
		WHERE upper(cs.code) = $2
		LIMIT 1`, typeID, sourceCode, sourceName).Scan(&contentSourceID, &sourceVersionID)
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO dndshare.content_source_compatibility (content_source_id, source_version_id, status)
		VALUES ($1, $2, 'native')
		ON CONFLICT (content_source_id, source_version_id) DO NOTHING`, contentSourceID, sourceVersionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM dndshare.item_content_source WHERE item_id = $1`, itemID); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO dndshare.item_content_source (item_id, content_source_id, primary_source)
		VALUES ($1, $2, true)`, itemID, contentSourceID)
	return err
}

// setBestiaryItemImage keeps imported artwork outside rules JSON. A manually
// assigned raster icon wins over the importer; importer-owned rows are updated
// in place so repeated jobs do not accumulate storage_image records.
func setBestiaryItemImage(ctx context.Context, tx pgx.Tx, itemID int64, imageKey, imageURL string) error {
	var imageID *int64
	var imageType *string
	if err := tx.QueryRow(ctx,
		`SELECT i.icon_image_id, img."type"
		 FROM dndshare.item i
		 LEFT JOIN dndshare.storage_image img ON img.id = i.icon_image_id
		 WHERE i.id = $1
		 FOR UPDATE OF i`,
		itemID,
	).Scan(&imageID, &imageType); err != nil {
		return err
	}

	imageURL = strings.TrimSpace(imageURL)
	imageKey = strings.TrimSpace(imageKey)
	if imageID != nil && imageType != nil && *imageType == "bestiary" {
		if imageURL == "" {
			if _, err := tx.Exec(ctx, `UPDATE dndshare.item SET icon_image_id = NULL WHERE id = $1`, itemID); err != nil {
				return err
			}
			_, err := tx.Exec(ctx, `UPDATE dndshare.storage_image SET deleted = true WHERE id = $1`, *imageID)
			return err
		}
		_, err := tx.Exec(ctx,
			`UPDATE dndshare.storage_image SET "key" = $1, url = $2, deleted = false WHERE id = $3`,
			imageKey, imageURL, *imageID,
		)
		return err
	}
	if imageID != nil || imageURL == "" {
		return nil
	}

	var savedImageID int64
	if err := tx.QueryRow(ctx,
		`INSERT INTO dndshare.storage_image (user_id, "key", url, "type")
		 VALUES (NULL, $1, $2, 'bestiary')
		 RETURNING id`,
		imageKey, imageURL,
	).Scan(&savedImageID); err != nil {
		return err
	}
	_, err := tx.Exec(ctx,
		`UPDATE dndshare.item SET icon_svg_id = NULL, icon_image_id = $1 WHERE id = $2`,
		savedImageID, itemID,
	)
	return err
}

// BestiaryFindSuggestByCode — id базового suggest по типу и коду (без регистра).
func (s *Store) BestiaryFindSuggestByCode(ctx context.Context, typeID int64, code string) (int64, bool, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM dndshare.suggest WHERE type_id = $1 AND user_id IS NULL AND lower(code) = lower($2) LIMIT 1`,
		typeID, code,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return id, true, nil
}

// BestiaryFindSuggestByValue — id базового suggest по типу и значению (без регистра).
func (s *Store) BestiaryFindSuggestByValue(ctx context.Context, typeID int64, value string) (int64, bool, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM dndshare.suggest WHERE type_id = $1 AND user_id IS NULL AND lower(value) = lower($2) LIMIT 1`,
		typeID, value,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return id, true, nil
}

// BestiaryAddSuggest добавляет базовый suggest с sequence-backed id и возвращает id.
func (s *Store) BestiaryAddSuggest(ctx context.Context, typeID int64, value string, code, desc *string) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.suggest (type_id, user_id, value, code, color, "desc")
		 VALUES ($1, NULL, $2, $3, NULL, $4)
		 RETURNING id`,
		typeID, value, code, desc,
	).Scan(&id)
	return id, err
}
