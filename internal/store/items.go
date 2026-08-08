package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// Item — строка dndshare.item (порт model/Item.kt). svg заполняется только в GetByIds.
type Item struct {
	ID        int64           `json:"id"`
	UserID    *int64          `json:"userId,omitempty"`
	Name      string          `json:"name"`
	NameEn    *string         `json:"nameEn,omitempty"`
	Data      json.RawMessage `json:"data"`
	TypeID    int64           `json:"typeId"`
	CreatedAt time.Time       `json:"createdAt"`
	ParentID  *int64          `json:"parentId,omitempty"`
	SVG       *string         `json:"svg,omitempty"`
}

// ItemType — строка dndshare.item_type (порт model/ItemType.kt). count дублирует countItems.
type ItemType struct {
	ID          int64           `json:"id"`
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	Fields      json.RawMessage `json:"fields"`
	SourceID    *int64          `json:"sourceId,omitempty"`
	SourceName  *string         `json:"sourceName,omitempty"`
	Color       *string         `json:"color,omitempty"`
	SVG         *string         `json:"svg,omitempty"`
	CountItems  int64           `json:"countItems"`
	Important   bool            `json:"important"`
	Count       int64           `json:"count"`
}

// SourceVersion — редакция системы из dndshare.source_version.
type SourceVersion struct {
	ID       int64  `json:"id"`
	SourceID int64  `json:"sourceId"`
	Version  string `json:"version"`
}

// Source — система из dndshare.source с доступными редакциями.
type Source struct {
	ID         int64           `json:"id"`
	Name       string          `json:"name"`
	Versions   []SourceVersion `json:"versions"`
	Version    *string         `json:"version,omitempty"` // compatibility for old clients
	CountItems int64           `json:"countItems"`
}

// ItemFilter — порт ItemRepository.ItemFilter. Type: "values"/"suggest"/"suggest_array"/"boolean".
type ItemFilter struct {
	Key    string
	Type   string
	Values []any
}

const itemColumns = "id, user_id, name, name_en, data, type_id, created_at, parent_id"

func scanItemRow(rows pgx.Rows) (Item, error) {
	var it Item
	var userID, parentID *int64
	var nameEn *string
	var data []byte
	if err := rows.Scan(&it.ID, &userID, &it.Name, &nameEn, &data, &it.TypeID, &it.CreatedAt, &parentID); err != nil {
		return Item{}, err
	}
	it.UserID = userID
	it.NameEn = nameEn
	it.ParentID = parentID
	it.Data = json.RawMessage(data)
	return it, nil
}

func collectItems(rows pgx.Rows) ([]Item, error) {
	defer rows.Close()
	out := []Item{}
	for rows.Next() {
		it, err := scanItemRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

// FindChildren — дети по parent_id (подрасы/архетипы).
func (s *Store) FindChildren(ctx context.Context, parentID int64) ([]Item, error) {
	rows, err := s.pool.Query(ctx,
		"SELECT "+itemColumns+" FROM dndshare.item WHERE parent_id = $1 ORDER BY name, id",
		parentID,
	)
	if err != nil {
		return nil, err
	}
	return collectItems(rows)
}

// GetByTypeAndUser — базовые + пользовательские предметы типа с фильтрами/пагинацией.
func (s *Store) GetByTypeAndUser(ctx context.Context, typeID int64, userID *int64, limit, offset int, filters []ItemFilter) ([]Item, error) {
	return s.searchItems(ctx, typeID, nil, userID, limit, offset, filters)
}

// SearchByTypeAndName — то же, но с ILIKE-поиском по имени.
func (s *Store) SearchByTypeAndName(ctx context.Context, typeID int64, q string, userID *int64, limit, offset int, filters []ItemFilter) ([]Item, error) {
	return s.searchItems(ctx, typeID, &q, userID, limit, offset, filters)
}

var pathSegmentRegex = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

func parseFilterPath(key string) []string {
	segments := strings.Split(key, ".")
	for i := range segments {
		segments[i] = strings.TrimSpace(segments[i])
	}
	if len(segments) == 0 {
		return nil
	}
	for _, seg := range segments {
		if !pathSegmentRegex.MatchString(seg) {
			return nil
		}
	}
	return segments
}

// textExtractSqlForPath: ["combat","cr"] -> data #>> '{combat,cr}'; ["cr"] -> data ->> 'cr'.
func textExtractSqlForPath(path []string) string {
	if len(path) == 1 {
		return "data ->> '" + path[0] + "'"
	}
	return "data #>> '{" + strings.Join(path, ",") + "}'"
}

// nestedSingletonJson: path=["combat","cr"], leaf=[3] -> {"combat":{"cr":[3]}}.
func nestedSingletonJson(path []string, leaf any) any {
	var current any = leaf
	for i := len(path) - 1; i >= 0; i-- {
		current = map[string]any{path[i]: current}
	}
	return current
}

func (s *Store) searchItems(ctx context.Context, typeID int64, q *string, userID *int64, limit, offset int, filters []ItemFilter) ([]Item, error) {
	args := []any{}
	add := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	where := []string{"type_id = " + add(typeID)}

	if userID != nil {
		where = append(where, "(user_id = "+add(*userID)+" OR user_id IS NULL)")
	} else {
		where = append(where, "user_id IS NULL")
	}

	if q != nil && strings.TrimSpace(*q) != "" {
		where = append(where, "name ILIKE "+add("%"+*q+"%"))
	}

	for _, filter := range filters {
		path := parseFilterPath(filter.Key)
		if path == nil {
			continue
		}
		textExtract := textExtractSqlForPath(path)

		switch filter.Type {
		case "suggest_array":
			parts := []string{}
			for _, value := range filter.Values {
				raw, _ := json.Marshal(nestedSingletonJson(path, []any{value}))
				parts = append(parts, "data @> "+add(string(raw))+"::jsonb")
			}
			if len(parts) > 0 {
				where = append(where, "("+strings.Join(parts, " OR ")+")")
			}
		case "suggest", "values":
			inParts := []string{}
			for _, value := range filter.Values {
				inParts = append(inParts, add(fmt.Sprint(value)))
			}
			scalarCondition := "(" + textExtract + ") IN (" + strings.Join(inParts, ", ") + ")"
			arrayParts := []string{}
			for _, value := range filter.Values {
				raw, _ := json.Marshal(nestedSingletonJson(path, []any{value}))
				arrayParts = append(arrayParts, "data @> "+add(string(raw))+"::jsonb")
			}
			all := append([]string{scalarCondition}, arrayParts...)
			where = append(where, "("+strings.Join(all, " OR ")+")")
		case "boolean", "bool":
			b := false
			if len(filter.Values) > 0 {
				if bv, ok := filter.Values[0].(bool); ok {
					b = bv
				}
			}
			where = append(where, "COALESCE(("+textExtract+")::boolean, false) = "+add(b))
		}
	}

	sql := "SELECT " + itemColumns + " FROM dndshare.item WHERE " + strings.Join(where, " AND ") +
		" ORDER BY name, id LIMIT " + add(limit) + " OFFSET " + add(offset)
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return collectItems(rows)
}

// GetByIds — предметы по списку id, с svg из svg_storage (JOIN по svg_id).
func (s *Store) GetByIds(ctx context.Context, ids []int64) ([]Item, error) {
	if len(ids) == 0 {
		return []Item{}, nil
	}
	args := make([]any, len(ids))
	ph := make([]string, len(ids))
	for i, id := range ids {
		args[i] = id
		ph[i] = fmt.Sprintf("$%d", i+1)
	}
	rows, err := s.pool.Query(ctx,
		`SELECT i.id, i.user_id, i.name, i.name_en, i.data, i.type_id, i.created_at, i.parent_id, ss.data AS svg_data
		   FROM dndshare.item i
		   LEFT JOIN dndshare.svg_storage ss ON ss.id = i.svg_id
		  WHERE i.id IN (`+strings.Join(ph, ", ")+`)`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Item{}
	for rows.Next() {
		var it Item
		var userID, parentID *int64
		var nameEn, svg *string
		var data []byte
		if err := rows.Scan(&it.ID, &userID, &it.Name, &nameEn, &data, &it.TypeID, &it.CreatedAt, &parentID, &svg); err != nil {
			return nil, err
		}
		it.UserID = userID
		it.NameEn = nameEn
		it.ParentID = parentID
		it.Data = json.RawMessage(data)
		it.SVG = svg
		out = append(out, it)
	}
	return out, rows.Err()
}

// SearchByTypesAndName — поиск сразу по нескольким типам (для search-multi).
func (s *Store) SearchByTypesAndName(ctx context.Context, typeIDs []int64, q string, userID *int64) ([]Item, error) {
	if len(typeIDs) == 0 {
		return []Item{}, nil
	}
	args := []any{}
	add := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	ph := make([]string, len(typeIDs))
	for i, id := range typeIDs {
		ph[i] = add(id)
	}
	like := add("%" + q + "%")
	var sql string
	if userID != nil {
		sql = "SELECT " + itemColumns + " FROM dndshare.item WHERE type_id IN (" + strings.Join(ph, ", ") +
			") AND name ILIKE " + like + " AND (user_id IS NULL OR user_id = " + add(*userID) +
			") ORDER BY user_id NULLS LAST, id LIMIT 30"
	} else {
		sql = "SELECT " + itemColumns + " FROM dndshare.item WHERE type_id IN (" + strings.Join(ph, ", ") +
			") AND name ILIKE " + like + " AND user_id IS NULL ORDER BY id LIMIT 30"
	}
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return collectItems(rows)
}

// FindBaseByTypeAndNameEn — базовый предмет по типу и nameEn (case-insensitive). ErrNotFound если нет.
func (s *Store) FindBaseByTypeAndNameEn(ctx context.Context, typeID int64, nameEn string) (Item, error) {
	rows, err := s.pool.Query(ctx,
		"SELECT "+itemColumns+" FROM dndshare.item WHERE type_id = $1 AND user_id IS NULL AND lower(name_en) = lower($2)",
		typeID, nameEn,
	)
	if err != nil {
		return Item{}, err
	}
	items, err := collectItems(rows)
	if err != nil {
		return Item{}, err
	}
	if len(items) == 0 {
		return Item{}, ErrNotFound
	}
	return items[0], nil
}

// UpdateBase — обновить базовый предмет по nameEn+type.
func (s *Store) UpdateBase(ctx context.Context, nameEn, name string, data json.RawMessage, typeID int64) error {
	_, err := s.pool.Exec(ctx,
		"UPDATE dndshare.item SET name = $1, data = CAST($2 AS jsonb) WHERE lower(name_en) = lower($3) AND type_id = $4 AND user_id IS NULL",
		name, jsonOrEmpty(data), nameEn, typeID,
	)
	return err
}

// CreateBase — создать базовый (user_id NULL) предмет.
func (s *Store) CreateBase(ctx context.Context, name, nameEn string, data json.RawMessage, typeID int64, parentID *int64) (Item, error) {
	data = jsonOrEmptyRaw(data)
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

// Create — создать пользовательский предмет.
func (s *Store) Create(ctx context.Context, userID int64, name string, data json.RawMessage, typeID int64, parentID *int64) (Item, error) {
	data = jsonOrEmptyRaw(data)
	var id int64
	err := s.pool.QueryRow(ctx,
		"INSERT INTO dndshare.item (user_id, name, data, type_id, parent_id) VALUES ($1, $2, CAST($3 AS jsonb), $4, $5) RETURNING id",
		userID, name, string(data), typeID, parentID,
	).Scan(&id)
	if err != nil {
		return Item{}, err
	}
	uid := userID
	return Item{ID: id, UserID: &uid, Name: name, Data: data, TypeID: typeID, CreatedAt: time.Now(), ParentID: parentID}, nil
}

// Update — обновить предмет; isAdmin снимает проверку владельца.
func (s *Store) Update(ctx context.Context, id, userID int64, isAdmin bool, name string, nameEn *string, data json.RawMessage) error {
	if isAdmin {
		_, err := s.pool.Exec(ctx,
			"UPDATE dndshare.item SET name = $1, name_en = $2, data = CAST($3 AS jsonb) WHERE id = $4",
			name, nameEn, jsonOrEmpty(data), id,
		)
		return err
	}
	_, err := s.pool.Exec(ctx,
		"UPDATE dndshare.item SET name = $1, name_en = $2, data = CAST($3 AS jsonb) WHERE id = $4 AND user_id = $5",
		name, nameEn, jsonOrEmpty(data), id, userID,
	)
	return err
}

// SetParent — переустановить parent_id.
func (s *Store) SetParent(ctx context.Context, id int64, parentID *int64) error {
	_, err := s.pool.Exec(ctx, "UPDATE dndshare.item SET parent_id = $1 WHERE id = $2", parentID, id)
	return err
}

// MakeBase — сделать предмет базовым (user_id = NULL).
func (s *Store) MakeBase(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, "UPDATE dndshare.item SET user_id = NULL WHERE id = $1", id)
	return err
}

// Delete — удалить предмет; isAdmin снимает проверку владельца.
func (s *Store) Delete(ctx context.Context, id, userID int64, isAdmin bool) error {
	if isAdmin {
		_, err := s.pool.Exec(ctx, "DELETE FROM dndshare.item WHERE id = $1", id)
		return err
	}
	_, err := s.pool.Exec(ctx, "DELETE FROM dndshare.item WHERE id = $1 AND user_id = $2", id, userID)
	return err
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

// --- item types ---

const itemTypeSelect = `SELECT it.id, it.name, it.description, it.fields, it.source_id, it.color, it.count_items, it.important,
		s.name AS source_name,
		ss.data AS svg_data
	FROM dndshare.item_type it
	LEFT JOIN dndshare.source s ON s.id = it.source_id
	LEFT JOIN dndshare.svg_storage ss ON ss.id = it.svg_id`

func scanItemType(rows pgx.Rows) (ItemType, error) {
	var it ItemType
	var description, sourceName, color, svg *string
	var sourceID *int64
	var fields []byte
	if err := rows.Scan(&it.ID, &it.Name, &description, &fields, &sourceID, &color, &it.CountItems, &it.Important, &sourceName, &svg); err != nil {
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
	it.SVG = svg
	it.Count = it.CountItems
	return it, nil
}

// ItemTypeGetAll — все типы предметов (опц. по источнику), с source_name и svg.
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
			if out[idx].Version == nil {
				v := *version
				out[idx].Version = &v
			}
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

// DefaultSourceVersionIDForTemplate сохраняет совместимость со старыми
// клиентами создания персонажей, которые ещё не передают sourceVersionId.
func (s *Store) DefaultSourceVersionIDForTemplate(ctx context.Context, templateName string) (*int64, error) {
	upperName := strings.ToUpper(templateName)
	var sourceName, version string
	switch {
	case upperName == "DND5" || upperName == "DND5E":
		sourceName, version = "DND5e", "2014"
	case strings.Contains(upperName, "VTM") || strings.Contains(upperName, "VAMPIRE"):
		sourceName, version = "Vampire: TM", "V20"
	default:
		return nil, nil
	}
	var id int64
	err := s.pool.QueryRow(ctx,
		`SELECT sv.id
		 FROM dndshare.source_version sv
		 JOIN dndshare.source src ON src.id = sv.source_id
		 WHERE lower(src.name) = lower($1) AND lower(sv.version) = lower($2)
		 LIMIT 1`, sourceName, version,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &id, nil
}
