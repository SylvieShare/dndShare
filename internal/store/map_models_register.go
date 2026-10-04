package store

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"

	"dndshare/internal/battlemap"
)

func (s *Store) RegisterMapModel(ctx context.Context, m battlemap.Model) (battlemap.Model, error) {
	if old, err := s.GetMapModel(ctx, m.ID); err == nil {
		if !reflect.DeepEqual(old, m) {
			return old, errors.New("model version is immutable; provide a new UUID and version")
		}
		return old, nil
	} else if !errors.Is(err, ErrNotFound) {
		return m, err
	}
	geometry, err := json.Marshal(map[string]any{"width": m.Width, "height": m.Height, "surfaceHeight": m.SurfaceHeight, "maxHeight": m.MaxHeight, "blockers": m.Blockers, "tags": m.Tags})
	if err != nil {
		return m, err
	}
	assets, err := json.Marshal(m.Assets)
	if err != nil {
		return m, err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO dndshare.map_model(id,collection,source_code,source_name,name,version,tile_type,terrain_type,wall_layout,geometry,assets)
VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,CAST($10 AS jsonb),CAST($11 AS jsonb)) ON CONFLICT DO NOTHING`,
		m.ID, m.Collection, m.SourceCode, m.SourceName, m.Name, m.Version, m.TileType, m.TerrainType, m.WallLayout, json.RawMessage(geometry), json.RawMessage(assets))
	if err != nil {
		return m, err
	}
	old, err := s.GetMapModel(ctx, m.ID)
	if err != nil {
		return m, errors.New("collection, sourceCode and version are already registered under another UUID")
	}
	if !reflect.DeepEqual(old, m) {
		return old, errors.New("model version is immutable")
	}
	return old, nil
}
