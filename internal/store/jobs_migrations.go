package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

// Запросы для админ-джоб миграций/пересчёта (порт репозиторных вызовов из jobs/*.kt).

// --- recount ---

// MigrateRecountItemTypes пересчитывает count_items у item_type.
func (s *Store) MigrateRecountItemTypes(ctx context.Context) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.item_type it
		 SET count_items = (SELECT COUNT(*) FROM dndshare.item i WHERE i.type_id = it.id)`,
	)
	return err
}

// MigrateRecountSources пересчитывает count_items у source.
func (s *Store) MigrateRecountSources(ctx context.Context) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.source s
		 SET count_items = (SELECT COALESCE(SUM(it.count_items), 0) FROM dndshare.item_type it WHERE it.source_id = s.id)`,
	)
	return err
}

// MigrateRecountSuggestTypes пересчитывает count_items у suggest_type.
func (s *Store) MigrateRecountSuggestTypes(ctx context.Context) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.suggest_type st
		 SET count_items = (SELECT COUNT(*) FROM dndshare.suggest s WHERE s.type_id = st.id)`,
	)
	return err
}

// --- migrate items to sections ---

// MigrateTemplateRow — строка char_template (id + сырая схема).
type MigrateTemplateRow struct {
	ID     int64
	Schema json.RawMessage
}

// MigrateSectionsLoadTemplates грузит все шаблоны (id, schema).
func (s *Store) MigrateSectionsLoadTemplates(ctx context.Context) ([]MigrateTemplateRow, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, schema FROM dndshare.char_template`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MigrateTemplateRow
	for rows.Next() {
		var r MigrateTemplateRow
		var schema *string
		if err := rows.Scan(&r.ID, &schema); err != nil {
			return nil, err
		}
		if schema != nil {
			r.Schema = json.RawMessage(*schema)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// MigrateCharRow — строка char (uuid, template_id, сырые data).
type MigrateCharRow struct {
	UUID       string
	TemplateID int64
	Data       json.RawMessage
}

// MigrateSectionsLoadChars грузит всех живых персонажей (uuid, template_id, data).
func (s *Store) MigrateSectionsLoadChars(ctx context.Context) ([]MigrateCharRow, error) {
	rows, err := s.pool.Query(ctx, `SELECT uuid, template_id, data FROM dndshare.char WHERE deleted = false`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MigrateCharRow
	for rows.Next() {
		var r MigrateCharRow
		var data string
		if err := rows.Scan(&r.UUID, &r.TemplateID, &data); err != nil {
			return nil, err
		}
		r.Data = json.RawMessage(data)
		out = append(out, r)
	}
	return out, rows.Err()
}

// MigrateSectionsUpdateChar сохраняет новые data персонажа (bump version).
func (s *Store) MigrateSectionsUpdateChar(ctx context.Context, uuid string, data json.RawMessage) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.char SET data = CAST($2 AS jsonb), changed_at = now(), version = version + 1 WHERE uuid = $1`,
		uuid, string(data),
	)
	return err
}

// --- migrate items (ability binding / spell classes) ---

// MigrateItemRow — строка item (id + сырые data).
type MigrateItemRow struct {
	ID   int64
	Data json.RawMessage
}

// MigrateLoadItemsByTypes грузит предметы с указанными type_id. baseOnly → только user_id IS NULL.
func (s *Store) MigrateLoadItemsByTypes(ctx context.Context, typeIDs []int64, baseOnly bool) ([]MigrateItemRow, error) {
	if len(typeIDs) == 0 {
		return nil, nil
	}
	placeholders := make([]string, len(typeIDs))
	args := make([]any, len(typeIDs))
	for i, t := range typeIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = t
	}
	q := `SELECT id, data FROM dndshare.item WHERE type_id IN (` + strings.Join(placeholders, ", ") + `)`
	if baseOnly {
		q += ` AND user_id IS NULL`
	}
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MigrateItemRow
	for rows.Next() {
		var r MigrateItemRow
		var data string
		if err := rows.Scan(&r.ID, &data); err != nil {
			return nil, err
		}
		r.Data = json.RawMessage(data)
		out = append(out, r)
	}
	return out, rows.Err()
}

// MigrateItemUpdateData сохраняет новые data предмета по id.
func (s *Store) MigrateItemUpdateData(ctx context.Context, id int64, data json.RawMessage) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.item SET data = CAST($2 AS jsonb) WHERE id = $1`,
		id, string(data),
	)
	return err
}

// --- bestiary import ---

// MigrateBestiaryFindItemByNameEn — есть ли базовый предмет типа с таким name_en (без регистра).
func (s *Store) MigrateBestiaryFindItemByNameEn(ctx context.Context, typeID int64, nameEn string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM dndshare.item WHERE type_id = $1 AND user_id IS NULL AND lower(name_en) = lower($2))`,
		typeID, nameEn,
	).Scan(&exists)
	return exists, err
}

// MigrateBestiaryUpdateItem обновляет базовый предмет по name_en (name + data).
func (s *Store) MigrateBestiaryUpdateItem(ctx context.Context, nameEn, name string, data json.RawMessage, typeID int64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.item SET name = $1, data = CAST($2 AS jsonb)
		 WHERE lower(name_en) = lower($3) AND type_id = $4 AND user_id IS NULL`,
		name, string(data), nameEn, typeID,
	)
	return err
}

// MigrateBestiaryCreateItem создаёт базовый предмет (user_id NULL) и возвращает id.
func (s *Store) MigrateBestiaryCreateItem(ctx context.Context, name, nameEn string, data json.RawMessage, typeID int64) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.item (user_id, name, name_en, data, type_id, parent_id)
		 VALUES (NULL, $1, $2, CAST($3 AS jsonb), $4, NULL) RETURNING id`,
		name, nameEn, string(data), typeID,
	).Scan(&id)
	return id, err
}

// MigrateBestiaryFindSuggestByCode — id базового suggest по типу и коду (без регистра).
func (s *Store) MigrateBestiaryFindSuggestByCode(ctx context.Context, typeID int64, code string) (int64, bool, error) {
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

// MigrateBestiaryFindSuggestByValue — id базового suggest по типу и значению (без регистра).
func (s *Store) MigrateBestiaryFindSuggestByValue(ctx context.Context, typeID int64, value string) (int64, bool, error) {
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

// MigrateBestiaryAddSuggest добавляет базовый suggest (id = MAX+1 в рамках типа) и возвращает id.
func (s *Store) MigrateBestiaryAddSuggest(ctx context.Context, typeID int64, value string, code, desc *string) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.suggest (id, type_id, user_id, value, code, color, "desc")
		 VALUES (COALESCE((SELECT MAX(id) FROM dndshare.suggest WHERE type_id = $1), 0) + 1, $1, NULL, $2, $3, NULL, $4)
		 RETURNING id`,
		typeID, value, code, desc,
	).Scan(&id)
	return id, err
}
