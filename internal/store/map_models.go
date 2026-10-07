package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"dndshare/internal/battlemap"
	"github.com/jackc/pgx/v5"
)

const mapModelColumns = `id::text,collection,source_code,source_name,name,version,tile_type,geometry,assets,definition_id::text`

var ErrInvalidMapModels = errors.New("invalid map models")

func scanMapModel(row pgx.Row) (battlemap.Model, error) {
	var m battlemap.Model
	var geometry, assets []byte
	err := row.Scan(&m.ID, &m.Collection, &m.SourceCode, &m.SourceName, &m.Name, &m.Version,
		&m.TileType, &geometry, &assets, &m.DefinitionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return m, ErrNotFound
	}
	if err != nil {
		return m, err
	}
	if err = json.Unmarshal(geometry, &m.ModelMetadata); err != nil {
		return m, err
	}
	err = json.Unmarshal(assets, &m.Assets)
	return m, err
}

func (s *Store) ListMapModels(ctx context.Context) ([]battlemap.Model, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model ORDER BY collection,source_code,version DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []battlemap.Model{}
	for rows.Next() {
		m, err := scanMapModel(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}

func (s *Store) GetMapModel(ctx context.Context, id string) (battlemap.Model, error) {
	return scanMapModel(s.pool.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model WHERE id=$1::uuid`, id))
}

func (s *Store) MapModelsForDocument(ctx context.Context, d battlemap.Document) (map[string]battlemap.ModelMetadata, error) {
	models, err := s.ListMapModels(ctx)
	if err != nil {
		return nil, err
	}
	result := make(map[string]battlemap.ModelMetadata, len(models))
	for _, m := range models {
		result[m.ID] = m.ModelMetadata
	}
	if err = battlemap.ValidateTileModels(d, result); err != nil {
		return result, fmt.Errorf("%w: %s", ErrInvalidMapModels, err)
	}
	return result, nil
}

func syncMapModels(ctx context.Context, tx pgx.Tx, table, parent string, id string, d battlemap.Document) error {
	if _, err := tx.Exec(ctx, `DELETE FROM dndshare.`+table+` WHERE `+parent+`=$1::uuid`, id); err != nil {
		return err
	}
	seen := map[string]bool{}
	ids := []string{}
	for _, tile := range d.Tiles {
		ids = append(ids, tile.ModelID)
	}
	for _, object := range d.Objects {
		if object.ModelID != "" {
			ids = append(ids, object.ModelID)
		}
	}
	for _, modelID := range ids {
		if seen[modelID] {
			continue
		}
		seen[modelID] = true
		if _, err := tx.Exec(ctx, `INSERT INTO dndshare.`+table+` (`+parent+`,model_id) VALUES($1::uuid,$2::uuid)`, id, modelID); err != nil {
			return err
		}
	}
	return nil
}
