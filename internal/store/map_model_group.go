package store

import (
	"context"
	"errors"
	"strings"

	"dndshare/internal/battlemap"
	"github.com/jackc/pgx/v5"
)

// UpdateMapModelGroup changes shared identity metadata without revising assets.
func (s *Store) UpdateMapModelGroup(ctx context.Context, id, expectedCode, code string) (string, error) {
	if !battlemap.ValidModelGroupCode(code) || !battlemap.ValidModelGroupCode(expectedCode) {
		return "", errors.New("valid current and target group codes required")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	var current string
	err = tx.QueryRow(ctx, `SELECT code FROM dndshare.map_model_definition WHERE id=$1 FOR UPDATE`, id).Scan(&current)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if strings.SplitN(current, "-", 2)[0] != strings.SplitN(code, "-", 2)[0] {
		return "", errors.New("group code must retain the collection prefix")
	}
	if current != code {
		if current != expectedCode {
			return "", ErrMapModelConflict
		}
		if _, err = tx.Exec(ctx, `UPDATE dndshare.map_model_definition SET code=$2 WHERE id=$1`, id, code); err != nil {
			return "", err
		}
	}
	return code, tx.Commit(ctx)
}
