package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// CreateBase — создать базовый (user_id NULL) предмет.
func (s *Store) CreateBase(ctx context.Context, name, nameEn string, data json.RawMessage, typeID int64, parentID *int64, automation ItemMetadataPatch) (Item, error) {
	if err := automation.Validate(); err != nil {
		return Item{}, err
	}
	meta := automation.Initial()
	hidden := automation.Hidden != nil && *automation.Hidden
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Item{}, err
	}
	defer tx.Rollback(ctx)
	if automation.Compatibility != nil || automation.DerivedFromItemID != nil || automation.ParentID != nil || automation.Hidden != nil {
		if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(1145980229)`); err != nil {
			return Item{}, err
		}
	}
	data = canonicalItemData(data)
	var id int64
	err = tx.QueryRow(ctx,
		"INSERT INTO dndshare.item (user_id, name, name_en, data, type_id, parent_id, automation_status, automation_note, requires_player_interaction, hidden) VALUES (NULL, $1, $2, CAST($3 AS jsonb), $4, $5, $6, $7, $8, $9) RETURNING id",
		name, nameEn, string(data), typeID, parentID, meta.AutomationStatus, meta.AutomationNote, meta.RequiresPlayerInteraction, hidden,
	).Scan(&id)
	if err != nil {
		return Item{}, err
	}
	if err = setItemDerivation(ctx, tx, id, automation); err != nil {
		return Item{}, err
	}
	if automation.Compatibility != nil {
		if err = setItemCompatibility(ctx, tx, id, *automation.Compatibility); err != nil {
			return Item{}, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return Item{}, err
	}

	en := nameEn
	return Item{Compatibility: initialCompatibility(automation), Hidden: hidden, ItemAutomation: meta, ID: id, Name: name, NameEn: &en, Data: data, TypeID: typeID, CreatedAt: time.Now(), ParentID: parentID}, nil
}

// Create — создать пользовательский предмет в его default custom source.
func (s *Store) Create(ctx context.Context, userID int64, name string, data json.RawMessage, typeID int64, parentID *int64, automation ItemMetadataPatch) (Item, error) {
	if err := automation.Validate(); err != nil {
		return Item{}, err
	}
	meta := automation.Initial()
	hidden := automation.Hidden != nil && *automation.Hidden
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Item{}, err
	}
	defer tx.Rollback(ctx)
	if automation.Compatibility != nil || automation.DerivedFromItemID != nil || automation.ParentID != nil || automation.Hidden != nil {
		if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(1145980229)`); err != nil {
			return Item{}, err
		}
	}
	data = canonicalItemData(data)
	var id, customSourceID int64
	err = tx.QueryRow(ctx,
		`WITH default_source AS (
		    INSERT INTO dndshare.custom_item_source (user_id, name, is_default)
		    VALUES ($1, 'Мои материалы', true)
		    ON CONFLICT (user_id) WHERE is_default
		    DO UPDATE SET name = dndshare.custom_item_source.name
		    RETURNING id
		)
		INSERT INTO dndshare.item (user_id, name, data, type_id, parent_id, custom_source_id, automation_status, automation_note, requires_player_interaction, hidden)
		SELECT $1, $2, CAST($3 AS jsonb), $4, $5, id, $6, $7, $8, $9 FROM default_source
		RETURNING id, custom_source_id`,
		userID, name, string(data), typeID, parentID, meta.AutomationStatus, meta.AutomationNote, meta.RequiresPlayerInteraction, hidden,
	).Scan(&id, &customSourceID)
	if err != nil {
		return Item{}, err
	}
	if err = setItemDerivation(ctx, tx, id, automation); err != nil {
		return Item{}, err
	}
	if automation.Compatibility != nil {
		if err = setItemCompatibility(ctx, tx, id, *automation.Compatibility); err != nil {
			return Item{}, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return Item{}, err
	}

	uid := userID
	return Item{Compatibility: initialCompatibility(automation), Hidden: hidden, ItemAutomation: meta, ID: id, UserID: &uid, Name: name, Data: data, TypeID: typeID, CreatedAt: time.Now(), ParentID: parentID, CustomSourceID: &customSourceID}, nil
}

// Update — обновить предмет; isAdmin снимает проверку владельца.
func (s *Store) Update(ctx context.Context, id, userID int64, isAdmin bool, name string, nameEn *string, data json.RawMessage, automation ItemMetadataPatch) error {
	if err := automation.Validate(); err != nil {
		return err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if automation.Compatibility != nil || automation.DerivedFromItemID != nil || automation.ParentID != nil || automation.Hidden != nil {
		if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(1145980229)`); err != nil {
			return err
		}
	}
	data = canonicalItemData(data)
	result, err := tx.Exec(ctx,
		`UPDATE dndshare.item SET name = $1, name_en = $2, data = CAST($3 AS jsonb),
            automation_status = COALESCE($7, automation_status),
            automation_note = COALESCE($8, automation_note),
            requires_player_interaction = COALESCE($9, requires_player_interaction),
            hidden = COALESCE($10, hidden)
         WHERE id = $4 AND ($6 OR user_id = $5)`,
		name, nameEn, jsonOrEmpty(data), id, userID, isAdmin,
		automation.AutomationStatus, automation.AutomationNote, automation.RequiresPlayerInteraction, automation.Hidden,
	)
	if err == nil && result.RowsAffected() == 0 {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if automation.ParentID != nil {
		parent := automation.ParentID
		if *parent < 0 {
			parent = nil
		}
		if err = setItemParent(ctx, tx, id, parent); err != nil {
			return err
		}
	}
	if err = setItemDerivation(ctx, tx, id, automation); err != nil {
		return err
	}
	if automation.Compatibility != nil {
		if err = setItemCompatibility(ctx, tx, id, *automation.Compatibility); err != nil {
			return err
		}
	}
	if err = validateItemEditionGraph(ctx, tx, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func setItemParent(ctx context.Context, tx pgx.Tx, id int64, parentID *int64) error {
	var err error
	if parentID != nil {
		var valid, cycle bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.item i JOIN dndshare.item p ON p.id=$2 JOIN dndshare.item_type it ON it.id=i.type_id JOIN dndshare.item_type pt ON pt.id=p.type_id WHERE i.id=$1 AND it.source_id=pt.source_id AND (p.user_id IS NULL OR p.user_id=i.user_id) AND NOT p.hidden)`, id, *parentID).Scan(&valid); err != nil {
			return err
		}
		if !valid {
			return &RulesValidationError{Message: "Родитель недоступен или принадлежит другой системе"}
		}
		if err = tx.QueryRow(ctx, `WITH RECURSIVE chain(id,path) AS (SELECT $2::bigint,ARRAY[$2::bigint] UNION ALL SELECT i.parent_id,chain.path||i.parent_id FROM chain JOIN dndshare.item i ON i.id=chain.id WHERE i.parent_id IS NOT NULL AND NOT i.parent_id=ANY(chain.path)) SELECT EXISTS(SELECT 1 FROM chain WHERE id=$1)`, id, *parentID).Scan(&cycle); err != nil {
			return err
		}
		if cycle {
			return &RulesValidationError{Message: "Родительские связи образуют цикл"}
		}
	}
	result, err := tx.Exec(ctx, "UPDATE dndshare.item SET parent_id = $1 WHERE id = $2", parentID, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// MakeBase — сделать предмет базовым (user_id = NULL).
func (s *Store) MakeBase(ctx context.Context, id int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(1145980229)`); err != nil {
		return err
	}
	var imageID, coverImageID *int64
	err = tx.QueryRow(ctx,
		`UPDATE dndshare.item
		    SET user_id = NULL, custom_source_id = NULL
		  WHERE id = $1
		  RETURNING icon_image_id, cover_image_id`,
		id,
	).Scan(&imageID, &coverImageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if err = validateItemEditionGraph(ctx, tx, id); err != nil {
		return err
	}
	if imageID != nil {
		if _, err := tx.Exec(ctx, `UPDATE dndshare.storage_image SET user_id = NULL WHERE id = $1`, *imageID); err != nil {
			return err
		}
	}
	if coverImageID != nil {
		if _, err := tx.Exec(ctx, `UPDATE dndshare.storage_image SET user_id = NULL WHERE id = $1`, *coverImageID); err != nil {
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
			"DELETE FROM dndshare.item WHERE id = $1 RETURNING icon_svg_id, icon_image_id, cover_image_id",
			id,
		).Scan(&refs.SVGID, &refs.ImageID, &refs.CoverImageID)
	} else {
		err = s.pool.QueryRow(ctx,
			"DELETE FROM dndshare.item WHERE id = $1 AND user_id = $2 RETURNING icon_svg_id, icon_image_id, cover_image_id",
			id, userID,
		).Scan(&refs.SVGID, &refs.ImageID, &refs.CoverImageID)
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
