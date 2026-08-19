package store

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
)

const itemTypeSelect = `SELECT it.id, it.name, it.description, it.fields, it.source_id, it.color, it.count_items, it.important,
		s.name AS source_name,
		it.icon_image_id,
		icon.url AS icon_image_url
	FROM dndshare.item_type it
	LEFT JOIN dndshare.source s ON s.id = it.source_id
	LEFT JOIN dndshare.storage_image icon ON icon.id = it.icon_image_id AND icon.deleted = false`

func scanItemType(rows pgx.Rows) (ItemType, error) {
	var it ItemType
	var description, sourceName, color, iconImageURL *string
	var sourceID, iconImageID *int64
	var fields []byte
	if err := rows.Scan(&it.ID, &it.Name, &description, &fields, &sourceID, &color, &it.CountItems, &it.Important, &sourceName, &iconImageID, &iconImageURL); err != nil {
		return ItemType{}, err
	}
	it.Description = description
	if fields == nil {
		it.Fields = json.RawMessage("[]")
	} else {
		it.Fields = json.RawMessage(fields)
	}
	it.SourceID = sourceID
	it.SourceName = sourceName
	it.Color = color
	it.IconImageID = iconImageID
	it.IconImageURL = iconImageURL
	it.Count = it.CountItems
	return it, nil
}

// ItemTypeGetAll — все типы предметов (опц. по источнику), с source_name и растровой иконкой.
func (s *Store) ItemTypeGetAll(ctx context.Context, sourceID *int64) ([]ItemType, error) {
	sql := itemTypeSelect
	args := []any{}
	if sourceID != nil {
		sql += " WHERE it.source_id = $1"
		args = append(args, *sourceID)
	}
	sql += " ORDER BY it.important DESC, s.name NULLS LAST, it.name"
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ItemType{}
	for rows.Next() {
		it, err := scanItemType(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

// ItemTypeGetById — тип предмета по id. ErrNotFound если нет.
func (s *Store) ItemTypeGetById(ctx context.Context, id int64) (ItemType, error) {
	rows, err := s.pool.Query(ctx, itemTypeSelect+" WHERE it.id = $1", id)
	if err != nil {
		return ItemType{}, err
	}
	defer rows.Close()
	if !rows.Next() {
		if err := rows.Err(); err != nil {
			return ItemType{}, err
		}
		return ItemType{}, ErrNotFound
	}
	it, err := scanItemType(rows)
	if err != nil {
		return ItemType{}, err
	}
	return it, nil
}

// --- sources ---

// SourceGetAll — все источники.
func (s *Store) SourceGetAll(ctx context.Context) ([]Source, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT src.id, src.name, src.count_items, sv.id, sv.version
		 FROM dndshare.source src
		 LEFT JOIN dndshare.source_version sv ON sv.source_id = src.id
		 ORDER BY src.name, sv.id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Source{}
	byID := map[int64]int{}
	for rows.Next() {
		var sourceID, countItems int64
		var name string
		var versionID *int64
		var version *string
		if err := rows.Scan(&sourceID, &name, &countItems, &versionID, &version); err != nil {
			return nil, err
		}
		idx, ok := byID[sourceID]
		if !ok {
			idx = len(out)
			byID[sourceID] = idx
			out = append(out, Source{ID: sourceID, Name: name, CountItems: countItems, Versions: []SourceVersion{}})
		}
		if versionID != nil && version != nil {
			out[idx].Versions = append(out[idx].Versions, SourceVersion{ID: *versionID, SourceID: sourceID, Version: *version})
		}
	}
	return out, rows.Err()
}

// SourceVersionExists проверяет, что выбранная редакция существует.
func (s *Store) SourceVersionExists(ctx context.Context, id int64) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM dndshare.source_version WHERE id = $1)`, id,
	).Scan(&exists)
	return exists, err
}
