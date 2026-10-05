package store

import (
	"context"
	"errors"

	"dndshare/internal/battlemap"
)

var ErrMapModelConflict = errors.New("map model revision conflict")

// Metadata edits append a revision. Placed UUIDs and their assets stay immutable.
func (s *Store) ReviseMapModel(ctx context.Context, expectedID string, edited battlemap.Model) (battlemap.Model, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return edited, err
	}
	defer tx.Rollback(ctx)
	old, err := scanMapModel(tx.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model WHERE id=$1::uuid`, expectedID))
	if err != nil {
		return edited, err
	}
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, old.Collection+":"+old.SourceCode); err != nil {
		return edited, err
	}
	var latestID string
	err = tx.QueryRow(ctx, `SELECT id::text FROM dndshare.map_model WHERE collection=$1 AND source_code=$2 AND source_name=$3 AND assets->'source'->>'sha256'=$4 ORDER BY version DESC LIMIT 1`,
		old.Collection, old.SourceCode, old.SourceName, old.Assets["source"].SHA256).Scan(&latestID)
	if err != nil {
		return edited, err
	}
	if latestID != expectedID {
		return edited, ErrMapModelConflict
	}
	edited.Collection, edited.CollectionName = old.Collection, old.CollectionName
	edited.SourceCode, edited.SourceName = old.SourceCode, old.SourceName
	edited.Assets = old.Assets
	if err = tx.QueryRow(ctx, `SELECT coalesce(max(version),0)+1 FROM dndshare.map_model WHERE collection=$1 AND source_code=$2`, old.Collection, old.SourceCode).Scan(&edited.Version); err != nil {
		return edited, err
	}
	geometry, assets, err := marshalMapModel(edited)
	if err != nil {
		return edited, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.map_model(id,collection,source_code,source_name,name,version,tile_type,terrain_type,wall_layout,geometry,assets)
VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,CAST($10 AS jsonb),CAST($11 AS jsonb))`,
		edited.ID, edited.Collection, edited.SourceCode, edited.SourceName, edited.Name, edited.Version, edited.TileType, edited.TerrainType, edited.WallLayout, geometry, assets)
	if IsUniqueViolation(err) {
		return edited, ErrMapModelConflict
	}
	if err != nil {
		return edited, err
	}
	if err = tx.Commit(ctx); err != nil {
		return edited, err
	}
	return edited, nil
}
