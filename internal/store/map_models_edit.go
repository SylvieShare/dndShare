package store

import (
	"context"
	"errors"

	"dndshare/internal/battlemap"
)

var ErrMapModelConflict = errors.New("map model revision conflict")

// Metadata edits append a revision. Placed UUIDs and their assets stay immutable.
func (s *Store) ReviseMapModel(ctx context.Context, expectedID string, edited battlemap.Model) (battlemap.Model, error) {
	return s.reviseMapModel(ctx, expectedID, edited, nil)
}

func (s *Store) ReviseMapModelWithBehaviour(ctx context.Context, expectedID string, edited battlemap.Model, behaviour *battlemap.ModelBehaviour) (battlemap.Model, error) {
	return s.reviseMapModel(ctx, expectedID, edited, behaviour)
}

func (s *Store) reviseMapModel(ctx context.Context, expectedID string, edited battlemap.Model, behaviour *battlemap.ModelBehaviour) (battlemap.Model, error) {
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
	edited.DefinitionID = old.DefinitionID
	edited.SourceCode, edited.SourceName = old.SourceCode, old.SourceName
	edited.Assets = old.Assets
	edited.Hidden = old.Hidden
	if err = tx.QueryRow(ctx, `SELECT coalesce(max(version),0)+1 FROM dndshare.map_model WHERE collection=$1 AND source_code=$2`, old.Collection, old.SourceCode).Scan(&edited.Version); err != nil {
		return edited, err
	}
	geometry, assets, err := marshalMapModel(edited)
	if err != nil {
		return edited, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.map_model(id,collection,source_code,source_name,name,version,tile_type,geometry,assets)
VALUES($1::uuid,$2,$3,$4,$5,$6,$7,CAST($8 AS jsonb),CAST($9 AS jsonb))`,
		edited.ID, edited.Collection, edited.SourceCode, edited.SourceName, edited.Name, edited.Version, edited.TileType, geometry, assets)
	if IsUniqueViolation(err) {
		return edited, ErrMapModelConflict
	}
	if err != nil {
		return edited, err
	}
	if behaviour != nil {
		if err = saveModelBehaviour(ctx, tx, old.DefinitionID, *behaviour); err != nil {
			return edited, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return edited, err
	}
	return edited, nil
}
