package store

import (
	"context"
	"encoding/json"

	"dndshare/internal/battlemap"
)

// Handbook models use their native one-cell scale. Keep the same base between
// visits without loading the map catalogue or persisting a viewer preference.
func (s *Store) GetHandbookModelBase(ctx context.Context) (battlemap.Model, error) {
	return scanMapModel(s.pool.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model
        WHERE category='creature-base' AND tile_type='object' AND (geometry->>'baseSize')::numeric=1
        ORDER BY id LIMIT 1`))
}

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
