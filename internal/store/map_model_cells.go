package store

import (
	"context"
	"encoding/json"
	"reflect"
	"sort"

	"dndshare/internal/battlemap"
)

type ModelPlacementCells struct {
	DefinitionID string                     `json:"definitionId"`
	Width        int                        `json:"width"`
	Height       int                        `json:"height"`
	Expected     []battlemap.PlacementPoint `json:"expected"`
	Cells        []battlemap.GridCell       `json:"cells"`
}

// Patch only the logical cells, under the same model row lock as geometry writers.
func (s *Store) UpdateMapModelPlacementCells(ctx context.Context, changes []ModelPlacementCells) error {
	if len(changes) == 0 || len(changes) > 1000 {
		return ErrInvalidMapModels
	}
	changes = append([]ModelPlacementCells(nil), changes...)
	sort.Slice(changes, func(i, j int) bool { return changes[i].DefinitionID < changes[j].DefinitionID })
	for i, c := range changes {
		if c.DefinitionID == "" || (i > 0 && changes[i-1].DefinitionID == c.DefinitionID) || c.Width < 1 || c.Height < 1 || len(c.Cells) != len(c.Expected) || len(c.Cells) > 256 {
			return ErrInvalidMapModels
		}
		for _, cell := range c.Cells {
			if cell.X < 0 || cell.Y < 0 || cell.X >= c.Width || cell.Y >= c.Height {
				return ErrInvalidMapModels
			}
		}
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	raw, _ := json.Marshal(changes)
	rows, err := tx.Query(ctx, `SELECT m.definition_id,m.geometry FROM dndshare.map_model m JOIN jsonb_to_recordset(CAST($1 AS jsonb)) c("definitionId" text) ON c."definitionId"=m.definition_id ORDER BY m.definition_id FOR UPDATE OF m`, json.RawMessage(raw))
	if err != nil {
		return err
	}
	current := map[string]mapModelGeometry{}
	for rows.Next() {
		var id string
		var geometry []byte
		if err = rows.Scan(&id, &geometry); err != nil {
			rows.Close()
			return err
		}
		var g mapModelGeometry
		if err = json.Unmarshal(geometry, &g); err != nil {
			rows.Close()
			return err
		}
		current[id] = g
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	if len(current) != len(changes) {
		return ErrNotFound
	}
	type patch struct {
		DefinitionID string                     `json:"definitionId"`
		Points       []battlemap.PlacementPoint `json:"points"`
	}
	patches := []patch{}
	for _, c := range changes {
		g := current[c.DefinitionID]
		if g.Width != c.Width || g.Height != c.Height || len(g.PlacementPoints) != len(c.Expected) {
			return ErrMapModelConflict
		}
		desired := append([]battlemap.PlacementPoint{}, c.Expected...)
		for i := range desired {
			cell := c.Cells[i]
			desired[i].Cell = &cell
		}
		if !reflect.DeepEqual(g.PlacementPoints, c.Expected) && !reflect.DeepEqual(g.PlacementPoints, desired) {
			return ErrMapModelConflict
		}
		patches = append(patches, patch{c.DefinitionID, desired})
	}
	raw, _ = json.Marshal(patches)
	_, err = tx.Exec(ctx, `UPDATE dndshare.map_model m SET geometry=jsonb_set(m.geometry,'{placementPoints}',c.points) FROM jsonb_to_recordset(CAST($1 AS jsonb)) c("definitionId" text,points jsonb) WHERE m.definition_id=c."definitionId"`, json.RawMessage(raw))
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
