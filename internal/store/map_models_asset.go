package store

import (
	"context"
	"dndshare/internal/battlemap"
	"maps"
)

// The dependent mesh hash prevents attaching an asset prepared from stale geometry.
func (s *Store) updateMapModelAsset(ctx context.Context, id, dependency, sha, kind string, asset battlemap.ModelAsset) (battlemap.Model, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return battlemap.Model{}, err
	}
	defer tx.Rollback(ctx)
	model, err := scanMapModel(tx.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model WHERE id=$1::uuid FOR UPDATE`, id))
	if err != nil {
		return model, err
	}
	if model.Assets[dependency].SHA256 != sha {
		return model, ErrMapModelConflict
	}
	model.Assets = maps.Clone(model.Assets)
	model.Assets[kind] = asset
	_, assets, err := marshalMapModel(model)
	if err != nil {
		return model, err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.map_model SET assets=CAST($2 AS jsonb) WHERE id=$1::uuid`, id, assets); err != nil {
		return model, err
	}
	if err = tx.Commit(ctx); err != nil {
		return model, err
	}
	return model, nil
}
func (s *Store) UpdateMapModelShadow(ctx context.Context, id, lodSHA string, asset battlemap.ModelAsset) (battlemap.Model, error) {
	return s.updateMapModelAsset(ctx, id, "lod", lodSHA, "shadow", asset)
}
func (s *Store) UpdateMapModelPreview(ctx context.Context, id, renderSHA string, asset battlemap.ModelAsset) (battlemap.Model, error) {
	return s.updateMapModelAsset(ctx, id, "render", renderSHA, "preview", asset)
}
