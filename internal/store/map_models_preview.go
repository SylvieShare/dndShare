package store

import (
	"context"
	"dndshare/internal/battlemap"
)

// Only the verified preview is new; keep the latest compatible version's other assets.
func (s *Store) ReviseMapModelPreview(ctx context.Context, expectedID, renderSHA, revisionID string, preview battlemap.ModelAsset) (battlemap.Model, error) {
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
	latest, err := scanMapModel(tx.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model WHERE definition_id=$1 ORDER BY version DESC LIMIT 1`, old.DefinitionID))
	if err != nil {
		return old, err
	}
	if latest.ID != old.ID && !battlemap.VisualRevision(old, latest) || latest.Assets["render"].SHA256 != renderSHA {
		return latest, ErrMapModelConflict
	}
	if latest.Assets["preview"] == preview {
		return latest, nil
	}
	latest.ID = revisionID
	latest.Assets["preview"] = preview
	if err = tx.QueryRow(ctx, `SELECT coalesce(max(version),0)+1 FROM dndshare.map_model WHERE collection=$1 AND source_code=$2`, old.Collection, old.SourceCode).Scan(&latest.Version); err != nil {
		return latest, err
	}
	geometry, assets, err := marshalMapModel(latest)
	if err != nil {
		return latest, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.map_model(id,collection,source_code,source_name,name,version,tile_type,geometry,assets)
        VALUES($1::uuid,$2,$3,$4,$5,$6,$7,CAST($8 AS jsonb),CAST($9 AS jsonb))`, latest.ID, latest.Collection, latest.SourceCode, latest.SourceName, latest.Name, latest.Version, latest.TileType, geometry, assets)
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
