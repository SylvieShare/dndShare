package store

import (
	"context"
	"dndshare/internal/battlemap"
	"encoding/json"
	"errors"
	"sort"
	"strings"
)

type ModelGroupingChange struct {
	DefinitionID        string `json:"definitionId"`
	ExpectedCode        string `json:"expectedCode"`
	ExpectedVariantCode string `json:"expectedVariantCode"`
	Code                string `json:"code"`
	VariantCode         string `json:"variantCode"`
}

func (s *Store) UpdateMapModelGrouping(ctx context.Context, changes []ModelGroupingChange) error {
	if len(changes) == 0 || len(changes) > 1000 {
		return errors.New("expected 1..1000 grouping changes")
	}
	changes = append([]ModelGroupingChange(nil), changes...)
	sort.Slice(changes, func(i, j int) bool { return changes[i].DefinitionID < changes[j].DefinitionID })
	seen := map[string]bool{}
	for _, c := range changes {
		if strings.TrimSpace(c.DefinitionID) == "" || len(c.DefinitionID) > 512 || seen[c.DefinitionID] || !battlemap.ValidModelGroupCode(c.Code) || !battlemap.ValidModelGroupCode(c.ExpectedCode) || !battlemap.ValidModelVariantCode(c.Code, c.VariantCode) || !battlemap.ValidModelVariantCode(c.ExpectedCode, c.ExpectedVariantCode) {
			return errors.New("invalid model grouping")
		}
		seen[c.DefinitionID] = true
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	raw, err := json.Marshal(changes)
	if err != nil {
		return err
	}
	rows, err := tx.Query(ctx, `SELECT d.id,d.code,d.variant_code FROM dndshare.map_model_definition d
        JOIN jsonb_to_recordset(CAST($1 AS jsonb)) AS input("definitionId" text) ON d.id=input."definitionId"
        ORDER BY d.id FOR UPDATE OF d`, json.RawMessage(raw))
	if err != nil {
		return err
	}
	type currentGrouping struct{ code, variant string }
	current := map[string]currentGrouping{}
	for rows.Next() {
		var id string
		var value currentGrouping
		if err = rows.Scan(&id, &value.code, &value.variant); err != nil {
			rows.Close()
			return err
		}
		current[id] = value
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	if len(current) != len(changes) {
		return ErrNotFound
	}
	for _, c := range changes {
		value := current[c.DefinitionID]
		if strings.SplitN(value.code, "-", 2)[0] != strings.SplitN(c.Code, "-", 2)[0] {
			return errors.New("grouping must retain collection prefix")
		}
		if value.code == c.Code && value.variant == c.VariantCode {
			continue
		}
		if value.code != c.ExpectedCode || value.variant != c.ExpectedVariantCode {
			return ErrMapModelConflict
		}
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.map_model_definition d SET code=input.code,variant_code=input."variantCode"
        FROM jsonb_to_recordset(CAST($1 AS jsonb)) AS input("definitionId" text,code text,"variantCode" text)
        WHERE d.id=input."definitionId" AND (d.code,d.variant_code) IS DISTINCT FROM (input.code,input."variantCode")`, json.RawMessage(raw)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
