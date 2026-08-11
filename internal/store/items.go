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
	CustomSourceID   *int64             `json:"customSourceId,omitempty"`
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

const itemColumns = "id, user_id, name, name_en, data, type_id, created_at, parent_id, custom_source_id"

func scanItemRow(rows pgx.Rows) (Item, error) {
	var it Item
	var userID, parentID, customSourceID *int64
	var nameEn *string
	var data []byte
	if err := rows.Scan(&it.ID, &userID, &it.Name, &nameEn, &data, &it.TypeID, &it.CreatedAt, &parentID, &customSourceID); err != nil {
		return Item{}, err
	}
	it.UserID = userID
	it.NameEn = nameEn
	it.ParentID = parentID
	it.CustomSourceID = customSourceID
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

func publicOrOwnedPredicate(alias string, userID *int64, userParam int) string {
	if userID == nil {
		return alias + ".user_id IS NULL"
	}
	return fmt.Sprintf("(%s.user_id IS NULL OR %s.user_id = $%d)", alias, alias, userParam)
}

// FindChildren — дети по parent_id (подрасы/архетипы).
func (s *Store) FindChildren(ctx context.Context, parentID int64, userID *int64, scope ContentScope) ([]Item, error) {
	args := []any{parentID}
	where := []string{"i.parent_id = $1"}
	if userID != nil {
		args = append(args, *userID)
	}
	where = append(where, publicOrOwnedPredicate("i", userID, len(args)))
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
func (s *Store) GetByIds(ctx context.Context, ids []int64, userID *int64) ([]Item, error) {
	if len(ids) == 0 {
		return []Item{}, nil
	}
	args := []any{ids}
	if userID != nil {
		args = append(args, *userID)
	}
	visibility := publicOrOwnedPredicate("i", userID, len(args))
	rows, err := s.pool.Query(ctx,
		`SELECT i.id, i.user_id, i.name, i.name_en, i.data, i.type_id, i.created_at, i.parent_id, i.custom_source_id, ss.data AS svg_data
		   FROM dndshare.item i
		   LEFT JOIN dndshare.svg_storage ss ON ss.id = i.svg_id
		  WHERE i.id = ANY($1) AND `+visibility,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Item{}
	for rows.Next() {
		var it Item
		var rowUserID, parentID, customSourceID *int64
		var nameEn, svg *string
		var data []byte
		if err := rows.Scan(&it.ID, &rowUserID, &it.Name, &nameEn, &data, &it.TypeID, &it.CreatedAt, &parentID, &customSourceID, &svg); err != nil {
			return nil, err
		}
		it.UserID = rowUserID
		it.NameEn = nameEn
		it.ParentID = parentID
		it.CustomSourceID = customSourceID
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
