package store

import (
	"bytes"
	"context"
	"dndshare/internal/battlemap"
	"encoding/json"
	"fmt"
)

type MapModelMerge struct {
	SourceID          string `json:"sourceId"`
	TargetID          string `json:"targetId"`
	ExpectedSourceLOD string `json:"expectedSourceLod"`
	ExpectedTargetLOD string `json:"expectedTargetLod"`
	FlagKey           string `json:"flagKey"`
	LightKey          string `json:"lightKey"`
	Name              string `json:"name"`
	Apply             bool   `json:"apply"`
}
type MapModelMergeResult struct {
	Applied     bool    `json:"applied"`
	Maps        int     `json:"maps"`
	SessionMaps int     `json:"sessionMaps"`
	Placements  int     `json:"placements"`
	SessionIDs  []int64 `json:"-"`
}

func (s *Store) MergeMapModel(ctx context.Context, input MapModelMerge) (MapModelMergeResult, error) {
	result := MapModelMergeResult{Applied: input.Apply}
	if input.SourceID == input.TargetID || input.FlagKey == "" || input.LightKey == "" {
		return result, fmt.Errorf("%w: Укажите два варианта, флаг и ключ света", ErrInvalidMapModels)
	}
	catalogue, err := s.ListMapModels(ctx)
	if err != nil {
		return result, err
	}
	behaviours, err := s.MapModelBehaviours(ctx)
	if err != nil {
		return result, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	source, err := scanMapModel(tx.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model WHERE id=$1::uuid FOR UPDATE`, input.SourceID))
	if err != nil {
		return result, err
	}
	target, err := scanMapModel(tx.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model WHERE id=$1::uuid FOR UPDATE`, input.TargetID))
	if err != nil {
		return result, err
	}
	if source.DefinitionID == target.DefinitionID || source.TileType != target.TileType || source.Width != target.Width || source.Height != target.Height || source.MountDepth != target.MountDepth || source.PlacementOffset != target.PlacementOffset || source.Assets["lod"].SHA256 != input.ExpectedSourceLOD || target.Assets["lod"].SHA256 != input.ExpectedTargetLOD {
		return result, fmt.Errorf("%w: Варианты или монтаж изменились; повторите проверку", ErrInvalidMapModels)
	}
	for _, m := range []battlemap.Model{source, target} {
		var revision int
		if err = tx.QueryRow(ctx, `SELECT revision FROM dndshare.map_model_definition WHERE id=$1 FOR UPDATE`, m.DefinitionID).Scan(&revision); err != nil {
			return result, err
		}
		if revision != behaviours[m.DefinitionID].Revision {
			return result, ErrMapModelConflict
		}
	}
	b := behaviours[target.DefinitionID]
	foundFlag, foundLight, foundEffect := false, false, false
	for _, f := range b.DefaultFlags {
		if f.Key == input.FlagKey {
			foundFlag = true
		}
	}
	for _, l := range b.DefaultLights {
		if l.Key == input.LightKey && l.FlagKey == input.FlagKey {
			foundLight = true
		}
	}
	for _, e := range b.DefaultEffects {
		if e.FlagKey == input.FlagKey {
			foundEffect = true
		}
	}
	if !foundFlag || !foundLight || !foundEffect {
		return result, fmt.Errorf("%w: У основы должны быть флаг и зависимые свет с эффектом", ErrInvalidMapModels)
	}
	models := map[string]battlemap.ModelMetadata{}
	for _, m := range catalogue {
		models[m.ID] = m.ModelMetadata
	}
	models[source.ID] = source.ModelMetadata
	models[target.ID] = target.ModelMetadata
	type documentRow struct {
		id        string
		sessionID int64
		raw       []byte
	}
	for _, table := range []string{"battle_map", "session_map"} {
		sessionColumn := "0::bigint"
		if table == "session_map" {
			sessionColumn = "session_id"
		}
		rows, queryErr := tx.Query(ctx, `SELECT id::text,`+sessionColumn+`,document FROM dndshare.`+table+` WHERE
            EXISTS(SELECT 1 FROM jsonb_array_elements(document->'tiles') t WHERE t->>'modelId' IN ($1,$2)) OR
            EXISTS(SELECT 1 FROM jsonb_array_elements(document->'objects') o WHERE o->>'modelId' IN ($1,$2)) FOR UPDATE`, source.ID, target.ID)
		if queryErr != nil {
			return result, queryErr
		}
		items := []documentRow{}
		for rows.Next() {
			var item documentRow
			if err = rows.Scan(&item.id, &item.sessionID, &item.raw); err != nil {
				rows.Close()
				return result, err
			}
			items = append(items, item)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return result, err
		}
		for _, item := range items {
			var d battlemap.Document
			if err = json.Unmarshal(item.raw, &d); err != nil {
				return result, err
			}
			before, _ := json.Marshal(d)
			n, mergeErr := battlemap.MergeLitVariant(&d, source.ID, target.ID, input.FlagKey, input.LightKey, models, behaviours)
			if mergeErr != nil {
				return result, fmt.Errorf("%w: %s %s: %s", ErrInvalidMapModels, table, item.id, mergeErr)
			}
			result.Placements += n
			after, _ := json.Marshal(d)
			if bytes.Equal(before, after) {
				continue
			}
			if table == "battle_map" {
				result.Maps++
			} else {
				result.SessionMaps++
				result.SessionIDs = append(result.SessionIDs, item.sessionID)
			}
			if !input.Apply {
				continue
			}
			if _, err = tx.Exec(ctx, `UPDATE dndshare.`+table+` SET document=CAST($2 AS jsonb),revision=revision+1,changed_at=now() WHERE id=$1::uuid`, item.id, json.RawMessage(after)); err != nil {
				return result, err
			}
			refTable := "battle_map_model"
			if table == "session_map" {
				refTable = "session_map_model"
			}
			if err = syncMapModels(ctx, tx, refTable, "map_id", item.id, d); err != nil {
				return result, err
			}
		}
	}
	if err = mergeModelTransitions(ctx, tx, source.DefinitionID, target.DefinitionID, input.Apply); err != nil {
		return result, err
	}
	if !input.Apply {
		return result, nil
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.map_model SET geometry=jsonb_set(geometry,'{hidden}','true'::jsonb) WHERE id=$1::uuid`, source.ID); err != nil {
		return result, err
	}
	if input.Name != "" {
		if len([]rune(input.Name)) > 160 {
			return result, fmt.Errorf("%w: Слишком длинное название", ErrInvalidMapModels)
		}
		if _, err = tx.Exec(ctx, `UPDATE dndshare.map_model SET name=$2,geometry=jsonb_set(geometry,'{name}',to_jsonb($2::text)) WHERE id=$1::uuid`, target.ID, input.Name); err != nil {
			return result, err
		}
	}
	return result, tx.Commit(ctx)
}
