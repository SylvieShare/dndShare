package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

// Suggest — строка dndshare.suggest (порт model/Suggest). Jackson NON_NULL: nullable-поля —
// указатели с omitempty, non-null примитивы — plain. svg приезжает из JOIN svg_storage.
type Suggest struct {
	ID     int64   `json:"id"`
	TypeID int64   `json:"typeId"`
	UserID *int64  `json:"userId,omitempty"`
	Value  string  `json:"value"`
	Code   *string `json:"code,omitempty"`
	Color  *string `json:"color,omitempty"`
	Desc   *string `json:"desc,omitempty"`
	SvgID  *int64  `json:"svgId,omitempty"`
	Svg    *string `json:"svg,omitempty"`
}

// SuggestType — строка dndshare.suggest_type (порт model/SuggestType) с source_name и svg из JOIN.
type SuggestType struct {
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	SourceID   *int64  `json:"sourceId,omitempty"`
	SourceName *string `json:"sourceName,omitempty"`
	Color      *string `json:"color,omitempty"`
	Svg        *string `json:"svg,omitempty"`
	CountItems int64   `json:"countItems"`
}

const suggestSelect = `SELECT s.id, s.type_id, s.user_id, s.value, s.code, s.color, s."desc", s.svg_id, ss.data AS svg
FROM dndshare.suggest s
LEFT JOIN dndshare.svg_storage ss ON ss.id = s.svg_id`

func scanSuggest(row pgx.Row) (Suggest, error) {
	var s Suggest
	err := row.Scan(&s.ID, &s.TypeID, &s.UserID, &s.Value, &s.Code, &s.Color, &s.Desc, &s.SvgID, &s.Svg)
	return s, err
}

func collectSuggests(rows pgx.Rows) ([]Suggest, error) {
	defer rows.Close()
	out := []Suggest{}
	for rows.Next() {
		s, err := scanSuggest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// SearchSuggestsByName ищет подсказки по подстроке value (ILIKE). При userId != nil видны
// базовые (user_id IS NULL) и собственные; иначе — только базовые.
func (s *Store) SearchSuggestsByName(ctx context.Context, q string, userID *int64, limit int) ([]Suggest, error) {
	pattern := "%" + q + "%"
	if userID != nil {
		rows, err := s.pool.Query(ctx,
			suggestSelect+` WHERE s.value ILIKE $1 AND (s.user_id IS NULL OR s.user_id = $2) ORDER BY lower(s.value), s.id LIMIT $3`,
			pattern, *userID, limit)
		if err != nil {
			return nil, err
		}
		return collectSuggests(rows)
	}
	rows, err := s.pool.Query(ctx,
		suggestSelect+` WHERE s.value ILIKE $1 AND s.user_id IS NULL ORDER BY lower(s.value), s.id LIMIT $2`,
		pattern, limit)
	if err != nil {
		return nil, err
	}
	return collectSuggests(rows)
}

// GetSuggestsByType возвращает подсказки типа: базовые + собственные пользователя (или только базовые).
func (s *Store) GetSuggestsByType(ctx context.Context, typeID int64, userID *int64) ([]Suggest, error) {
	if userID != nil {
		rows, err := s.pool.Query(ctx,
			suggestSelect+` WHERE s.type_id = $1 AND (s.user_id IS NULL OR s.user_id = $2) ORDER BY lower(s.value), s.id`,
			typeID, *userID)
		if err != nil {
			return nil, err
		}
		return collectSuggests(rows)
	}
	rows, err := s.pool.Query(ctx,
		suggestSelect+` WHERE s.type_id = $1 AND s.user_id IS NULL ORDER BY lower(s.value), s.id`,
		typeID)
	if err != nil {
		return nil, err
	}
	return collectSuggests(rows)
}

// GetSuggestsByTypes группирует подсказки по typeId. В результате есть ключ для каждого
// запрошенного типа (пустой список, если совпадений нет).
func (s *Store) GetSuggestsByTypes(ctx context.Context, typeIDs []int64, userID *int64) (map[int64][]Suggest, error) {
	if len(typeIDs) == 0 {
		return map[int64][]Suggest{}, nil
	}
	in, args := int64InClause(typeIDs, 1)
	var rows pgx.Rows
	var err error
	if userID != nil {
		args = append(args, *userID)
		rows, err = s.pool.Query(ctx,
			suggestSelect+fmt.Sprintf(` WHERE s.type_id IN (%s) AND (s.user_id IS NULL OR s.user_id = $%d) ORDER BY s.type_id, lower(s.value), s.id`, in, len(args)),
			args...)
	} else {
		rows, err = s.pool.Query(ctx,
			suggestSelect+fmt.Sprintf(` WHERE s.type_id IN (%s) AND s.user_id IS NULL ORDER BY s.type_id, lower(s.value), s.id`, in),
			args...)
	}
	if err != nil {
		return nil, err
	}
	items, err := collectSuggests(rows)
	if err != nil {
		return nil, err
	}
	grouped := map[int64][]Suggest{}
	for _, id := range typeIDs {
		grouped[id] = []Suggest{}
	}
	for _, it := range items {
		grouped[it.TypeID] = append(grouped[it.TypeID], it)
	}
	return grouped, nil
}

// GetSuggestsByIds returns base suggestions plus rows owned by the current
// user. Anonymous/API catalogue reads never expose user-owned rows.
func (s *Store) GetSuggestsByIds(ctx context.Context, typeID int64, ids []int64, userID *int64) ([]Suggest, error) {
	if len(ids) == 0 {
		return []Suggest{}, nil
	}
	in, args := int64InClause(ids, 2)
	allArgs := append([]any{typeID}, args...)
	if userID != nil {
		allArgs = append(allArgs, *userID)
	}
	visibility := publicOrOwnedPredicate("s", userID, len(allArgs))
	rows, err := s.pool.Query(ctx,
		suggestSelect+fmt.Sprintf(` WHERE s.type_id = $1 AND s.id IN (%s) AND %s`, in, visibility),
		allArgs...)
	if err != nil {
		return nil, err
	}
	return collectSuggests(rows)
}

// FindBaseSuggestByValue ищет базовую (user_id IS NULL) подсказку по value без учёта регистра.
func (s *Store) FindBaseSuggestByValue(ctx context.Context, typeID int64, value string) (Suggest, error) {
	row := s.pool.QueryRow(ctx,
		suggestSelect+` WHERE s.type_id = $1 AND s.user_id IS NULL AND lower(s.value) = lower($2)`,
		typeID, value)
	sg, err := scanSuggest(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Suggest{}, ErrNotFound
	}
	return sg, err
}

// FindBaseSuggestByCode ищет базовую подсказку по code без учёта регистра.
func (s *Store) FindBaseSuggestByCode(ctx context.Context, typeID int64, code string) (Suggest, error) {
	row := s.pool.QueryRow(ctx,
		suggestSelect+` WHERE s.type_id = $1 AND s.user_id IS NULL AND lower(s.code) = lower($2)`,
		typeID, code)
	sg, err := scanSuggest(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Suggest{}, ErrNotFound
	}
	return sg, err
}

// AddBaseSuggest inserts a base suggestion. The database sequence allocates
// public ids atomically; the (type_id, id) primary key keeps existing base ids
// valid.
func (s *Store) AddBaseSuggest(ctx context.Context, typeID int64, value string, code, desc, color *string) (Suggest, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.suggest (type_id, user_id, value, code, color, "desc")
		 VALUES ($1, NULL, $2, $3, $4, $5)
		 RETURNING id`,
		typeID, value, code, color, desc).Scan(&id)
	if err != nil {
		return Suggest{}, err
	}
	return Suggest{ID: id, TypeID: typeID, UserID: nil, Value: value, Code: code, Color: color, Desc: desc}, nil
}

// AddSuggest inserts a user suggestion with a sequence-backed public id. New
// user ids therefore cannot overlap, including under concurrent requests.
func (s *Store) AddSuggest(ctx context.Context, typeID, userID int64, value string, code, color, desc *string) (Suggest, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.suggest (type_id, user_id, value, code, color, "desc")
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id`,
		typeID, userID, value, code, color, desc).Scan(&id)
	if err != nil {
		return Suggest{}, err
	}
	uid := userID
	return Suggest{ID: id, TypeID: typeID, UserID: &uid, Value: value, Code: code, Color: color, Desc: desc}, nil
}

// UpdateSuggest обновляет подсказку. isAdmin снимает проверку владельца (user_id).
func (s *Store) UpdateSuggest(ctx context.Context, id, typeID, userID int64, isAdmin bool, value string, code, color, desc *string, svgID *int64) error {
	where := `WHERE id = $6 AND type_id = $7 AND user_id = $8`
	if isAdmin {
		where = `WHERE id = $6 AND type_id = $7`
	}
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.suggest SET value = $1, code = $2, color = $3, "desc" = $4, svg_id = $5 `+where,
		value, code, color, desc, svgID, id, typeID, userID)
	return err
}

// GetEditableSuggest возвращает подсказку, доступную для правки: любую (admin) или собственную.
func (s *Store) GetEditableSuggest(ctx context.Context, id, typeID, userID int64, isAdmin bool) (Suggest, error) {
	where := ` WHERE s.id = $1 AND s.type_id = $2 AND s.user_id = $3`
	if isAdmin {
		where = ` WHERE s.id = $1 AND s.type_id = $2`
	}
	var row pgx.Row
	if isAdmin {
		row = s.pool.QueryRow(ctx, suggestSelect+where, id, typeID)
	} else {
		row = s.pool.QueryRow(ctx, suggestSelect+where, id, typeID, userID)
	}
	sg, err := scanSuggest(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Suggest{}, ErrNotFound
	}
	return sg, err
}

// MakeBaseSuggest переводит подсказку в базовые (user_id = NULL).
func (s *Store) MakeBaseSuggest(ctx context.Context, id, typeID int64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.suggest SET user_id = NULL WHERE id = $1 AND type_id = $2`,
		id, typeID)
	return err
}

// DeleteSuggest удаляет подсказку. Возвращает true, если строка была удалена.
func (s *Store) DeleteSuggest(ctx context.Context, id, typeID, userID int64, isAdmin bool) (bool, error) {
	where := `WHERE id = $1 AND type_id = $2 AND user_id = $3`
	var affected int64
	if isAdmin {
		ct, err := s.pool.Exec(ctx, `DELETE FROM dndshare.suggest WHERE id = $1 AND type_id = $2`, id, typeID)
		if err != nil {
			return false, err
		}
		affected = ct.RowsAffected()
	} else {
		ct, err := s.pool.Exec(ctx, `DELETE FROM dndshare.suggest `+where, id, typeID, userID)
		if err != nil {
			return false, err
		}
		affected = ct.RowsAffected()
	}
	return affected > 0, nil
}

// GetAllSuggestTypes возвращает типы подсказок (с source_name и svg из JOIN). sourceID != nil —
// фильтр по источнику.
func (s *Store) GetAllSuggestTypes(ctx context.Context, sourceID *int64) ([]SuggestType, error) {
	query := `SELECT st.id, st.name, st.source_id, st.color, st.count_items,
	       src.name AS source_name,
	       ss.data AS svg_data
	FROM dndshare.suggest_type st
	LEFT JOIN dndshare."source" src ON src.id = st.source_id
	LEFT JOIN dndshare.svg_storage ss ON ss.id = st.svg_id`
	var rows pgx.Rows
	var err error
	if sourceID != nil {
		rows, err = s.pool.Query(ctx, query+` WHERE st.source_id = $1 ORDER BY src.name NULLS LAST, st.name`, *sourceID)
	} else {
		rows, err = s.pool.Query(ctx, query+` ORDER BY src.name NULLS LAST, st.name`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SuggestType{}
	for rows.Next() {
		var t SuggestType
		if err := rows.Scan(&t.ID, &t.Name, &t.SourceID, &t.Color, &t.CountItems, &t.SourceName, &t.Svg); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// --- svg_storage ---
// Тонкие обёртки над общими SaveSvg/GetSvg/DeleteSvg (svg.go) — те же svg_storage,
// имена сохранены ради читаемости вызовов suggests/mcp.

// SaveSuggestSvg сохраняет svg-разметку и возвращает её id.
func (s *Store) SaveSuggestSvg(ctx context.Context, data string) (int64, error) {
	return s.SaveSvg(ctx, data)
}

// GetSuggestSvgData возвращает svg-разметку по id (ErrNotFound, если нет).
func (s *Store) GetSuggestSvgData(ctx context.Context, id int64) (string, error) {
	return s.GetSvg(ctx, id)
}

// DeleteSuggestSvg удаляет svg-разметку по id.
func (s *Store) DeleteSuggestSvg(ctx context.Context, id int64) error {
	return s.DeleteSvg(ctx, id)
}

// int64InClause строит плейсхолдеры $start.. для IN (...) и соответствующий срез args.
func int64InClause(ids []int64, start int) (string, []any) {
	ph := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		ph[i] = fmt.Sprintf("$%d", start+i)
		args[i] = id
	}
	return strings.Join(ph, ", "), args
}
