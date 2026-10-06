package store

import (
	"context"

	"dndshare/internal/battlemap"
)

// Shadow publication appends a compatible revision without retransferring or
// rehashing the already verified render, LOD, preview and original STL assets.
func (s *Store) ReviseMapModelShadow(ctx context.Context, expectedID, lodSHA, revisionID string, shadow battlemap.ModelAsset) (battlemap.Model, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return battlemap.Model{}, err
	}
	defer tx.Rollback(ctx)
	old, err := scanMapModel(tx.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model WHERE id=$1::uuid`, expectedID))
	if err != nil {
		return old, err
	}
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, old.Collection+":"+old.SourceCode); err != nil {
		return old, err
	}
	latest, err := scanMapModel(tx.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model WHERE collection=$1 AND source_code=$2 AND source_name=$3 AND assets->'source'->>'sha256'=$4 ORDER BY version DESC LIMIT 1`,
		old.Collection, old.SourceCode, old.SourceName, old.Assets["source"].SHA256))
	if err != nil {
		return old, err
	}
	if latest.ID != old.ID && !battlemap.VisualRevision(old, latest) || latest.Assets["lod"].SHA256 != lodSHA {
		return latest, ErrMapModelConflict
	}
	if latest.Assets["shadow"] == shadow {
		return latest, nil
	}
	latest.ID = revisionID
	latest.Assets["shadow"] = shadow
	if err = tx.QueryRow(ctx, `SELECT coalesce(max(version),0)+1 FROM dndshare.map_model WHERE collection=$1 AND source_code=$2`, old.Collection, old.SourceCode).Scan(&latest.Version); err != nil {
		return latest, err
	}
	geometry, assets, err := marshalMapModel(latest)
	if err != nil {
		return latest, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.map_model(id,collection,source_code,source_name,name,version,tile_type,geometry,assets)
VALUES($1::uuid,$2,$3,$4,$5,$6,$7,CAST($8 AS jsonb),CAST($9 AS jsonb))`,
		latest.ID, latest.Collection, latest.SourceCode, latest.SourceName, latest.Name, latest.Version, latest.TileType, geometry, assets)
	if IsUniqueViolation(err) {
		return latest, ErrMapModelConflict
	}
	if err != nil {
		return latest, err
	}
	if err = tx.Commit(ctx); err != nil {
		return latest, err
	}
	return latest, nil
}
