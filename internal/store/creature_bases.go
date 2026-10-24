package store

import (
	"context"
	"encoding/json"

	"dndshare/internal/battlemap"
)

// Validate even disabled assignments: they can be enabled again without choosing
// another asset, and must never grant access to an unrelated hidden model.
func (s *Store) ValidateCreatureBases(ctx context.Context, state battlemap.State) error {
	ids := []string{}
	for _, token := range state.Tokens {
		if token.BaseModelID != "" {
			ids = append(ids, token.BaseModelID)
		}
	}
	sizes, err := s.CreatureBaseSizes(ctx, ids)
	if err != nil {
		return err
	}
	return battlemap.ValidateCreatureBaseAssignments(state, sizes)
}

func (s *Store) CreatureBaseSizes(ctx context.Context, ids []string) (map[string]float64, error) {
	sizes := map[string]float64{}
	if len(ids) == 0 {
		return sizes, nil
	}
	rows, err := s.pool.Query(ctx, `SELECT id::text,category,tile_type,geometry FROM dndshare.map_model WHERE id=ANY($1::uuid[])`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id, category, kind string
		var raw []byte
		if err = rows.Scan(&id, &category, &kind, &raw); err != nil {
			return nil, err
		}
		var geometry struct {
			BaseSize float64 `json:"baseSize"`
		}
		if err = json.Unmarshal(raw, &geometry); err != nil {
			return nil, err
		}
		if category == "creature-base" && kind == "object" {
			sizes[id] = geometry.BaseSize
		}
	}
	return sizes, rows.Err()
}
