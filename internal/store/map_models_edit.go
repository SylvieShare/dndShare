package store

import (
	"context"
	"dndshare/internal/battlemap"
	"errors"
	"fmt"
)

var ErrMapModelConflict = errors.New("map model update conflict")

func (s *Store) UpdateMapModel(ctx context.Context, id string, edited battlemap.Model) (battlemap.Model, error) {
	return s.UpdateMapModelWithBehaviour(ctx, id, edited, nil)
}
func (s *Store) UpdateMapModelWithBehaviour(ctx context.Context, id string, edited battlemap.Model, behaviour *battlemap.ModelBehaviour) (battlemap.Model, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return edited, err
	}
	defer tx.Rollback(ctx)
	old, err := scanMapModel(tx.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model WHERE id=$1::uuid FOR UPDATE`, id))
	if err != nil {
		return edited, err
	}
	edited.ID, edited.DefinitionID = old.ID, old.DefinitionID
	edited.Collection, edited.CollectionName = old.Collection, old.CollectionName
	edited.SourceCode, edited.SourceName = old.SourceCode, old.SourceName
	edited.Assets, edited.Hidden = old.Assets, old.Hidden
	if !battlemap.ValidModelGroupCode(edited.Code) {
		return edited, fmt.Errorf("%w: Некорректный код группы", ErrInvalidMapModels)
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.map_model_definition SET code=$2 WHERE id=$1`, old.DefinitionID, edited.Code); err != nil {
		return edited, err
	}
	geometry, assets, err := marshalMapModel(edited)
	if err != nil {
		return edited, err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.map_model SET name=$2,tile_type=$3,geometry=CAST($4 AS jsonb),assets=CAST($5 AS jsonb) WHERE id=$1::uuid`, id, edited.Name, edited.TileType, geometry, assets); err != nil {
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
