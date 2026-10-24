package store

import (
	"context"
	"encoding/json"

	"dndshare/internal/battlemap"
)

// Use the item's footprint, with stable selection between visits.
func (s *Store) GetHandbookModelBase(ctx context.Context, size float64) (battlemap.Model, error) {
	return scanMapModel(s.pool.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model
        WHERE category='creature-base' AND tile_type='object' AND (geometry->>'baseSize')::numeric=$1
        ORDER BY id LIMIT 1`, size))
}

// Match frontend creatureFootprint by dictionary code, never by suggest ID.
// Non-creature items use a one-cell presentation base.
func (s *Store) ItemModelSize(ctx context.Context, itemID int64) (float64, error) {
	var size float64
	err := s.pool.QueryRow(ctx, `SELECT COALESCE(MAX(CASE s.code
        WHEN 'tiny' THEN 0.5 WHEN 'small' THEN 1 WHEN 'medium' THEN 1
        WHEN 'large' THEN 2 WHEN 'huge' THEN 3 WHEN 'gargantuan' THEN 4 END),1)
        FROM dndshare.item i JOIN dndshare.suggest s ON s.type_id=18 AND s.user_id IS NULL
        AND (i.data #> '{identity,size}') @> jsonb_build_array(s.id)
        WHERE i.id=$1 AND i.type_id=6`, itemID).Scan(&size)
	return size, err
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
