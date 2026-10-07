package store

import (
	"context"
	"dndshare/internal/battlemap"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
)

func (s *Store) MapModelBehaviours(ctx context.Context) (map[string]battlemap.ModelBehaviour, error) {
	rows, err := s.pool.Query(ctx, `SELECT d.id::text,d.revision,d.default_lights,
        coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'toDefinitionId',t.to_model_id,'action',t.action) ORDER BY t.action,t.id)
        FROM dndshare.map_model_transition t WHERE t.from_model_id=d.id),'[]'::jsonb)
        FROM dndshare.map_model_definition d`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[string]battlemap.ModelBehaviour{}
	for rows.Next() {
		var id string
		var b battlemap.ModelBehaviour
		var lights, transitions []byte
		if err = rows.Scan(&id, &b.Revision, &lights, &transitions); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(lights, &b.DefaultLights); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(transitions, &b.Transitions); err != nil {
			return nil, err
		}
		result[id] = b
	}
	return result, rows.Err()
}

func saveModelBehaviour(ctx context.Context, tx pgx.Tx, id string, b battlemap.ModelBehaviour) error {
	if err := battlemap.ValidateModelBehaviour(b); err != nil {
		return fmt.Errorf("%w: %s", ErrInvalidMapModels, err)
	}
	for _, t := range b.Transitions {
		var sameKind bool
		err := tx.QueryRow(ctx, `SELECT (a.tile_type='object')=(z.tile_type='object') AND a.definition_id<>z.definition_id
            FROM (SELECT tile_type,definition_id FROM dndshare.map_model WHERE definition_id=$1 ORDER BY version DESC LIMIT 1) a,
                 (SELECT tile_type,definition_id FROM dndshare.map_model WHERE definition_id=$2 ORDER BY version DESC LIMIT 1) z`, id, t.ToDefinitionID).Scan(&sameKind)
		if err == pgx.ErrNoRows || err == nil && !sameKind {
			return fmt.Errorf("%w: Переход должен вести к другой модели того же типа", ErrInvalidMapModels)
		}
		if err != nil {
			return err
		}
	}
	if b.DefaultLights == nil {
		b.DefaultLights = []battlemap.ModelLight{}
	}
	data, err := json.Marshal(b.DefaultLights)
	if err != nil {
		return err
	}
	result, err := tx.Exec(ctx, `UPDATE dndshare.map_model_definition SET revision=revision+1,default_lights=CAST($3 AS jsonb) WHERE id=$1 AND revision=$2`, id, b.Revision, json.RawMessage(data))
	if err != nil {
		return err
	}
	if result.RowsAffected() != 1 {
		return ErrMapModelConflict
	}
	if _, err = tx.Exec(ctx, `DELETE FROM dndshare.map_model_transition WHERE from_model_id=$1`, id); err != nil {
		return err
	}
	for _, t := range b.Transitions {
		_, err = tx.Exec(ctx, `INSERT INTO dndshare.map_model_transition(id,from_model_id,to_model_id,action) VALUES($1::uuid,$2,$3,$4)`, t.ID, id, t.ToDefinitionID, t.Action)
		if IsUniqueViolation(err) {
			return ErrMapModelConflict
		}
		if err != nil {
			return err
		}
	}
	return nil
}
