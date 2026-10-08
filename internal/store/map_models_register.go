package store

import (
	"context"
	"dndshare/internal/battlemap"
	"errors"
)

// Publishing replaces the current assets and metadata; placements retain their UUID.
func (s *Store) RegisterMapModel(ctx context.Context, m battlemap.Model) (battlemap.Model, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return m, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, m.Collection+":"+m.SourceCode+":"+m.SourceName); err != nil {
		return m, err
	}
	old, err := scanMapModel(tx.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model WHERE collection=$1 AND source_code=$2 AND source_name=$3 FOR UPDATE`, m.Collection, m.SourceCode, m.SourceName))
	exists := err == nil
	if err != nil && !errors.Is(err, ErrNotFound) {
		return m, err
	}
	if exists {
		if m.ID != old.ID {
			return old, errors.New("existing model must retain its UUID")
		}
		m.DefinitionID, m.Code = old.DefinitionID, old.Code
		m.Hidden = m.Hidden || old.Hidden
	}
	geometry, assets, err := marshalMapModel(m)
	if err != nil {
		return m, err
	}
	if exists {
		_, err = tx.Exec(ctx, `UPDATE dndshare.map_model SET name=$2,tile_type=$3,geometry=CAST($4 AS jsonb),assets=CAST($5 AS jsonb) WHERE id=$1::uuid`, m.ID, m.Name, m.TileType, geometry, assets)
	} else {
		_, err = tx.Exec(ctx, `INSERT INTO dndshare.map_model(id,collection,source_code,source_name,name,tile_type,geometry,assets) VALUES($1::uuid,$2,$3,$4,$5,$6,CAST($7 AS jsonb),CAST($8 AS jsonb))`, m.ID, m.Collection, m.SourceCode, m.SourceName, m.Name, m.TileType, geometry, assets)
	}
	if err != nil {
		return m, err
	}
	saved, err := scanMapModel(tx.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model WHERE id=$1::uuid`, m.ID))
	if err != nil {
		return m, err
	}
	if err = tx.Commit(ctx); err != nil {
		return m, err
	}
	return saved, nil
}
