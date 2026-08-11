package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// CharacterTemplate identifies one code-backed game-system template.
type CharacterTemplate struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// GetTemplate возвращает шаблон по id (ErrNotFound, если строки нет).
func (s *Store) GetTemplate(ctx context.Context, id int64) (CharacterTemplate, error) {
	var template CharacterTemplate
	err := s.pool.QueryRow(ctx,
		`SELECT id, name FROM dndshare.char_template WHERE id = $1`,
		id,
	).Scan(&template.ID, &template.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		return CharacterTemplate{}, ErrNotFound
	}
	if err != nil {
		return CharacterTemplate{}, err
	}
	return template, nil
}
