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

// BestiaryUpdateItem обновляет базовый предмет и его внешнее изображение.
func (s *Store) BestiaryUpdateItem(ctx context.Context, nameEn, name string, data json.RawMessage, imageURL string, typeID int64) error {
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
	if err := setBestiaryItemImage(ctx, tx, itemID, imageURL); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// BestiaryCreateItem создаёт базовый предмет (user_id NULL) и возвращает id.
func (s *Store) BestiaryCreateItem(ctx context.Context, name, nameEn string, data json.RawMessage, imageURL string, typeID int64) (int64, error) {
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
	if err := setBestiaryItemImage(ctx, tx, id, imageURL); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return id, nil
}

// setBestiaryItemImage keeps imported artwork outside rules JSON. A manually
// assigned raster icon wins over the importer; importer-owned rows are updated
// in place so repeated jobs do not accumulate storage_image records.
func setBestiaryItemImage(ctx context.Context, tx pgx.Tx, itemID int64, imageURL string) error {
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
	if imageID != nil && imageType != nil && *imageType == "bestiary" {
		if imageURL == "" {
			if _, err := tx.Exec(ctx, `UPDATE dndshare.item SET icon_image_id = NULL WHERE id = $1`, itemID); err != nil {
				return err
			}
			_, err := tx.Exec(ctx, `UPDATE dndshare.storage_image SET deleted = true WHERE id = $1`, *imageID)
			return err
		}
		_, err := tx.Exec(ctx,
			`UPDATE dndshare.storage_image SET url = $1, deleted = false WHERE id = $2`,
			imageURL, *imageID,
		)
		return err
	}
	if imageID != nil || imageURL == "" {
		return nil
	}

	var savedImageID int64
	if err := tx.QueryRow(ctx,
		`INSERT INTO dndshare.storage_image (user_id, "key", url, "type")
		 VALUES (NULL, NULL, $1, 'bestiary')
		 RETURNING id`,
		imageURL,
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
