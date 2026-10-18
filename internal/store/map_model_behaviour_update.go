package store

import (
	"context"
	"dndshare/internal/battlemap"
	"errors"
	"github.com/jackc/pgx/v5"
)

func (s *Store) GetMapModelBehaviour(ctx context.Context, id string) (battlemap.ModelBehaviour, error) {
	behaviours, err := s.MapModelBehaviours(ctx)
	if err != nil {
		return battlemap.ModelBehaviour{}, err
	}
	b, ok := behaviours[id]
	if !ok {
		return b, ErrNotFound
	}
	return b, nil
}

// Behaviour belongs to the logical model and does not revise immutable assets.
func (s *Store) UpdateMapModelBehaviour(ctx context.Context, id string, b battlemap.ModelBehaviour) (battlemap.ModelBehaviour, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return b, err
	}
	defer tx.Rollback(ctx)
	var revision int
	err = tx.QueryRow(ctx, `SELECT revision FROM dndshare.map_model_definition WHERE id=$1 FOR UPDATE`, id).Scan(&revision)
	if errors.Is(err, pgx.ErrNoRows) {
		return b, ErrNotFound
	}
	if err != nil {
		return b, err
	}
	if revision != b.Revision {
		return b, ErrMapModelConflict
	}
	if b.DefaultLights == nil {
		b.DefaultLights = []battlemap.ModelLight{}
	}
	if b.Transitions == nil {
		b.Transitions = []battlemap.ModelTransition{}
	}
	if err = saveModelBehaviour(ctx, tx, id, b); err != nil {
		return b, err
	}
	if err = tx.Commit(ctx); err != nil {
		return b, err
	}
	b.Revision++
	return b, nil
}
