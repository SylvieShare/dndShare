package store

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// Item — строка dndshare.item (порт model/Item.kt). svg заполняется только в GetByIds.
type Item struct {
	ID               int64              `json:"id"`
	UserID           *int64             `json:"userId,omitempty"`
	Name             string             `json:"name"`
	NameEn           *string            `json:"nameEn,omitempty"`
	Data             json.RawMessage    `json:"data"`
	TypeID           int64              `json:"typeId"`
	CreatedAt        time.Time          `json:"createdAt"`
	ParentID         *int64             `json:"parentId,omitempty"`
	SVG              *string            `json:"svg,omitempty"`
	ContentSourceIDs []int64            `json:"contentSourceIds"`
	ContentSources   []ContentSourceRef `json:"contentSources"`
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
func (s *Store) FindChildren(ctx context.Context, parentID int64, scope ContentScope) ([]Item, error) {
	args := []any{parentID}
	where := []string{"i.parent_id = $1"}
	where = appendContentScopeSQL(where, &args, scope)
	rows, err := s.pool.Query(ctx,
		"SELECT "+prefixedItemColumns("i")+" FROM dndshare.item i WHERE "+strings.Join(where, " AND ")+" ORDER BY i.name, i.id",
		args...,
	)
	if err != nil {
		return nil, err
	}
	items, err := collectItems(rows)
	if err != nil {
		return nil, err
	}
	return s.AttachItemContentSources(ctx, items)
}

// GetByTypeAndUser — базовые + пользовательские предметы типа с фильтрами/пагинацией.
func (s *Store) GetByTypeAndUser(ctx context.Context, typeID int64, userID *int64, limit, offset int, filters []ItemFilter, scope ContentScope) ([]Item, error) {
	return s.searchItems(ctx, typeID, nil, userID, limit, offset, filters, scope)
}

// SearchByTypeAndName — то же, но с ILIKE-поиском по имени.
func (s *Store) SearchByTypeAndName(ctx context.Context, typeID int64, q string, userID *int64, limit, offset int, filters []ItemFilter, scope ContentScope) ([]Item, error) {
	return s.searchItems(ctx, typeID, &q, userID, limit, offset, filters, scope)
}

func prefixedItemColumns(alias string) string {
	parts := strings.Split(itemColumns, ", ")
	for i := range parts {
		parts[i] = alias + "." + parts[i]
	}
	return strings.Join(parts, ", ")
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

func (s *Store) searchItems(ctx context.Context, typeID int64, q *string, userID *int64, limit, offset int, filters []ItemFilter, scope ContentScope) ([]Item, error) {
	args := []any{}
	add := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	where := []string{"i.type_id = " + add(typeID)}

	if userID != nil {
		where = append(where, "(i.user_id = "+add(*userID)+" OR i.user_id IS NULL)")
	} else {
		where = append(where, "i.user_id IS NULL")
	}

	if q != nil && strings.TrimSpace(*q) != "" {
		where = append(where, "i.name ILIKE "+add("%"+*q+"%"))
	}

	where = appendContentScopeSQL(where, &args, scope)

	for _, filter := range filters {
		path := parseFilterPath(filter.Key)
		if path == nil {
			continue
		}
		textExtract := strings.Replace(textExtractSqlForPath(path), "data", "i.data", 1)

		switch filter.Type {
		case "suggest_array":
			parts := []string{}
			for _, value := range filter.Values {
				raw, _ := json.Marshal(nestedSingletonJson(path, []any{value}))
				parts = append(parts, "i.data @> "+add(string(raw))+"::jsonb")
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
				arrayParts = append(arrayParts, "i.data @> "+add(string(raw))+"::jsonb")
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

	sql := "SELECT " + prefixedItemColumns("i") + " FROM dndshare.item i WHERE " + strings.Join(where, " AND ") +
		" ORDER BY i.name, i.id LIMIT " + add(limit) + " OFFSET " + add(offset)
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	items, err := collectItems(rows)
	if err != nil {
		return nil, err
	}
	return s.AttachItemContentSources(ctx, items)
}

func appendContentScopeSQL(where []string, args *[]any, scope ContentScope) []string {
	if !scope.RestrictToIDs && scope.SourceVersionID == nil {
		return where
	}
	add := func(v any) string {
		*args = append(*args, v)
		return fmt.Sprintf("$%d", len(*args))
	}
	selectedCondition := "TRUE"
	if len(scope.IDs) > 0 {
		selectedCondition = "ics.content_source_id = ANY(" + add(scope.IDs) + ")"
	} else if scope.RestrictToIDs {
		selectedCondition = "FALSE"
	}
	compatibility := "TRUE"
	if scope.SourceVersionID != nil {
		target := add(*scope.SourceVersionID)
		effective := `COALESCE(ivc.status,
		  CASE WHEN cs.native_source_version_id = ` + target + ` THEN 'native' ELSE csc.status END,
		  'blocked')`
		compatibility = effective + " <> 'blocked'"
		if !scope.AllowLegacy {
			compatibility += " AND " + effective + " <> 'legacy'"
		}
		compatibility = `(` + compatibility + `)
		  AND (ivc.item_id IS NOT NULL OR cs.native_source_version_id = ` + target + ` OR csc.content_source_id IS NOT NULL)`
	}
	where = append(where, `(
	  i.user_id IS NOT NULL
	  OR NOT EXISTS (SELECT 1 FROM dndshare.item_content_source unassigned WHERE unassigned.item_id = i.id)
	  OR EXISTS (
	    SELECT 1
	      FROM dndshare.item_content_source ics
	      JOIN dndshare.content_source cs ON cs.id = ics.content_source_id
	      LEFT JOIN dndshare.item_version_compatibility ivc
	        ON ivc.item_id = i.id`+func() string {
		if scope.SourceVersionID == nil {
			return " AND false"
		}
		return " AND ivc.source_version_id = " + fmt.Sprintf("$%d", len(*args))
	}()+`
	      LEFT JOIN dndshare.content_source_compatibility csc
	        ON csc.content_source_id = cs.id`+func() string {
		if scope.SourceVersionID == nil {
			return " AND false"
		}
		return " AND csc.source_version_id = " + fmt.Sprintf("$%d", len(*args))
	}()+`
	     WHERE ics.item_id = i.id
		       AND `+selectedCondition+`
	       AND `+compatibility+`
	  )
	)`)
	return where
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return s.AttachItemContentSources(ctx, out)
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
	items, err := collectItems(rows)
	if err != nil {
		return nil, err
	}
	return s.AttachItemContentSources(ctx, items)
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
