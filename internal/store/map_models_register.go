package store

import (
	"context"
	"errors"
	"reflect"

	"dndshare/internal/battlemap"
)

func (s *Store) RegisterMapModel(ctx context.Context, m battlemap.Model) (battlemap.Model, error) {
	if old, err := s.GetMapModel(ctx, m.ID); err == nil {
		m.DefinitionID = old.DefinitionID
		m.Code = old.Code
		if !reflect.DeepEqual(old, m) {
			return old, errors.New("model version is immutable; provide a new UUID and version")
		}
		return old, nil
	} else if !errors.Is(err, ErrNotFound) {
		return m, err
	}
	var retired bool
	if err := s.pool.QueryRow(ctx, `SELECT coalesce(bool_or((geometry->>'hidden')::boolean),false) FROM dndshare.map_model WHERE collection=$1 AND source_code=$2`, m.Collection, m.SourceCode).Scan(&retired); err != nil {
		return m, err
	}
	m.Hidden = m.Hidden || retired
	geometry, assets, err := marshalMapModel(m)
	if err != nil {
		return m, err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO dndshare.map_model(id,collection,source_code,source_name,name,version,tile_type,geometry,assets)
VALUES($1::uuid,$2,$3,$4,$5,$6,$7,CAST($8 AS jsonb),CAST($9 AS jsonb)) ON CONFLICT DO NOTHING`,
		m.ID, m.Collection, m.SourceCode, m.SourceName, m.Name, m.Version, m.TileType, geometry, assets)
	if err != nil {
		return m, err
	}
	old, err := s.GetMapModel(ctx, m.ID)
	if err != nil {
		return m, errors.New("collection, sourceCode and version are already registered under another UUID")
	}
	m.DefinitionID = old.DefinitionID
	m.Code = old.Code
	if !reflect.DeepEqual(old, m) {
		return old, errors.New("model version is immutable")
	}
	return old, nil
}
