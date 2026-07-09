package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
)

// CharacterTemplate — строка dndshare.char_template (порт model/CharacterTemplate.kt).
type CharacterTemplate struct {
	ID                int64           `json:"id"`
	Name              string          `json:"name"`
	Schema            json.RawMessage `json:"schema"`
	CreateForm        json.RawMessage `json:"createForm,omitempty"`
	PathValuesForList json.RawMessage `json:"pathValuesForList,omitempty"`
}

// TemplateBlockType — строка dndshare.template_block_type (порт model/TemplateBlockType.kt).
type TemplateBlockType struct {
	Type           string          `json:"type"`
	Label          string          `json:"label"`
	Category       string          `json:"category"`
	Fields         json.RawMessage `json:"fields"`
	DefaultContent json.RawMessage `json:"defaultContent"`
}

// isBlankJSON — пусто/пробелы, чтобы null/blank schema не роняла список (как takeIf isNotBlank в Kotlin).
func isBlankJSON(raw []byte) bool {
	for _, b := range raw {
		if b != ' ' && b != '\t' && b != '\n' && b != '\r' {
			return false
		}
	}
	return true
}

func mapTemplate(schema, createForm, pathValues *[]byte) CharacterTemplate {
	var t CharacterTemplate
	if schema != nil && !isBlankJSON(*schema) {
		t.Schema = json.RawMessage(*schema)
	} else {
		t.Schema = json.RawMessage(`{}`)
	}
	if createForm != nil {
		t.CreateForm = json.RawMessage(*createForm)
	}
	if pathValues != nil {
		t.PathValuesForList = json.RawMessage(*pathValues)
	}
	return t
}

// GetTemplate возвращает шаблон по id (ErrNotFound, если строки нет).
func (s *Store) GetTemplate(ctx context.Context, id int64) (CharacterTemplate, error) {
	var schema, createForm, pathValues *[]byte
	var name string
	err := s.pool.QueryRow(ctx,
		`SELECT id, name, schema, create_form, path_values_for_list FROM dndshare.char_template WHERE id = $1`,
		id,
	).Scan(&id, &name, &schema, &createForm, &pathValues)
	if errors.Is(err, pgx.ErrNoRows) {
		return CharacterTemplate{}, ErrNotFound
	}
	if err != nil {
		return CharacterTemplate{}, err
	}
	t := mapTemplate(schema, createForm, pathValues)
	t.ID = id
	t.Name = name
	return t, nil
}

// CreateTemplate создаёт шаблон с дефолтной схемой и возвращает его id.
func (s *Store) CreateTemplate(ctx context.Context, name string) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.char_template (name, schema) VALUES ($1, CAST($2 AS jsonb)) RETURNING id`,
		name, `{"blocks":[],"dictionaries":{}}`,
	).Scan(&id)
	return id, err
}

// UpdateSchema перезаписывает schema шаблона.
func (s *Store) UpdateSchema(ctx context.Context, id int64, schema json.RawMessage) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.char_template SET schema = CAST($2 AS jsonb) WHERE id = $1`,
		id, string(schema),
	)
	return err
}

// GetAllBlockTypes возвращает типы блоков (порт TemplateBlockTypeRepository.getAll).
func (s *Store) GetAllBlockTypes(ctx context.Context) ([]TemplateBlockType, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT type, label, category, fields, default_content FROM dndshare.template_block_type ORDER BY category, type`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TemplateBlockType
	for rows.Next() {
		var t TemplateBlockType
		var fields, defaultContent []byte
		if err := rows.Scan(&t.Type, &t.Label, &t.Category, &fields, &defaultContent); err != nil {
			return nil, err
		}
		t.Fields = json.RawMessage(fields)
		t.DefaultContent = json.RawMessage(defaultContent)
		out = append(out, t)
	}
	return out, rows.Err()
}
