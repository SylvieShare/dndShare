package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// UpdateBase — обновить базовый предмет по nameEn+type.
func (s *Store) UpdateBase(ctx context.Context, nameEn, name string, data json.RawMessage, typeID int64) error {
	data = canonicalItemData(data)
	_, err := s.pool.Exec(ctx,
		"UPDATE dndshare.item SET name = $1, data = CAST($2 AS jsonb) WHERE lower(name_en) = lower($3) AND type_id = $4 AND user_id IS NULL",
		name, jsonOrEmpty(data), nameEn, typeID,
	)
	return err
}

// CreateBase — создать базовый (user_id NULL) предмет.
func (s *Store) CreateBase(ctx context.Context, name, nameEn string, data json.RawMessage, typeID int64, parentID *int64) (Item, error) {
	data = canonicalItemData(data)
	var id int64
	err := s.pool.QueryRow(ctx,
		"INSERT INTO dndshare.item (user_id, name, name_en, data, type_id, parent_id) VALUES (NULL, $1, $2, CAST($3 AS jsonb), $4, $5) RETURNING id",
		name, nameEn, string(data), typeID, parentID,
	).Scan(&id)
	if err != nil {
		return Item{}, err
	}
	en := nameEn
	return Item{ID: id, Name: name, NameEn: &en, Data: data, TypeID: typeID, CreatedAt: time.Now(), ParentID: parentID}, nil
}

// Create — создать пользовательский предмет в его default custom source.
func (s *Store) Create(ctx context.Context, userID int64, name string, data json.RawMessage, typeID int64, parentID *int64) (Item, error) {
	data = canonicalItemData(data)
	var id, customSourceID int64
	err := s.pool.QueryRow(ctx,
		`WITH default_source AS (
		    INSERT INTO dndshare.custom_item_source (user_id, name, is_default)
		    VALUES ($1, 'Мои материалы', true)
		    ON CONFLICT (user_id) WHERE is_default
		    DO UPDATE SET name = dndshare.custom_item_source.name
		    RETURNING id
		)
		INSERT INTO dndshare.item (user_id, name, data, type_id, parent_id, custom_source_id)
		SELECT $1, $2, CAST($3 AS jsonb), $4, $5, id FROM default_source
		RETURNING id, custom_source_id`,
		userID, name, string(data), typeID, parentID,
	).Scan(&id, &customSourceID)
	if err != nil {
		return Item{}, err
	}
	uid := userID
	return Item{ID: id, UserID: &uid, Name: name, Data: data, TypeID: typeID, CreatedAt: time.Now(), ParentID: parentID, CustomSourceID: &customSourceID}, nil
}

// Update — обновить предмет; isAdmin снимает проверку владельца.
func (s *Store) Update(ctx context.Context, id, userID int64, isAdmin bool, name string, nameEn *string, data json.RawMessage) error {
	data = canonicalItemData(data)
	var result pgconn.CommandTag
	var err error
	if isAdmin {
		result, err = s.pool.Exec(ctx,
			"UPDATE dndshare.item SET name = $1, name_en = $2, data = CAST($3 AS jsonb) WHERE id = $4",
			name, nameEn, jsonOrEmpty(data), id,
		)
	} else {
		result, err = s.pool.Exec(ctx,
			"UPDATE dndshare.item SET name = $1, name_en = $2, data = CAST($3 AS jsonb) WHERE id = $4 AND user_id = $5",
			name, nameEn, jsonOrEmpty(data), id, userID,
		)
	}
	if err == nil && result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// SetParent — переустановить parent_id.
func (s *Store) SetParent(ctx context.Context, id int64, parentID *int64) error {
	_, err := s.pool.Exec(ctx, "UPDATE dndshare.item SET parent_id = $1 WHERE id = $2", parentID, id)
	return err
}

// MakeBase — сделать предмет базовым (user_id = NULL).
func (s *Store) MakeBase(ctx context.Context, id int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var imageID *int64
	err = tx.QueryRow(ctx,
		`UPDATE dndshare.item
		    SET user_id = NULL, custom_source_id = NULL
		  WHERE id = $1
		  RETURNING icon_image_id`,
		id,
	).Scan(&imageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if imageID != nil {
		if _, err := tx.Exec(ctx, `UPDATE dndshare.storage_image SET user_id = NULL WHERE id = $1`, *imageID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// Delete — удалить предмет; isAdmin снимает проверку владельца.
func (s *Store) Delete(ctx context.Context, id, userID int64, isAdmin bool) (ItemIconRefs, error) {
	var refs ItemIconRefs
	var err error
	if isAdmin {
		err = s.pool.QueryRow(ctx,
			"DELETE FROM dndshare.item WHERE id = $1 RETURNING icon_svg_id, icon_image_id",
			id,
		).Scan(&refs.SVGID, &refs.ImageID)
	} else {
		err = s.pool.QueryRow(ctx,
			"DELETE FROM dndshare.item WHERE id = $1 AND user_id = $2 RETURNING icon_svg_id, icon_image_id",
			id, userID,
		).Scan(&refs.SVGID, &refs.ImageID)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ItemIconRefs{}, ErrNotFound
	}
	return refs, err
}

func jsonOrEmpty(data json.RawMessage) string {
	return string(jsonOrEmptyRaw(data))
}

func jsonOrEmptyRaw(data json.RawMessage) json.RawMessage {
	if len(data) == 0 {
		return json.RawMessage("{}")
	}
	return data
}

func canonicalItemData(data json.RawMessage) json.RawMessage {
	data = jsonOrEmptyRaw(data)
	var object map[string]json.RawMessage
	if err := json.Unmarshal(data, &object); err != nil || object == nil {
		return data
	}
	delete(object, "customSourceId")
	delete(object, "custom_source_id")
	canonical, err := json.Marshal(object)
	if err != nil {
		return data
	}
	return canonical
}
