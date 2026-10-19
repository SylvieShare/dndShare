package store

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"strings"

	"dndshare/internal/battlemap"
	"github.com/jackc/pgx/v5"
)

type ModelCatalogueValue struct {
	Name     string `json:"name"`
	NameEn   string `json:"nameEn"`
	Category string `json:"category"`
	Code     string `json:"code"`
}
type ModelCatalogueChange struct {
	DefinitionID string              `json:"definitionId"`
	Expected     ModelCatalogueValue `json:"expected"`
	ModelCatalogueValue
}
type ModelGroupNames struct {
	Collection     string `json:"collection"`
	Code           string `json:"code"`
	Name           string `json:"name"`
	NameEn         string `json:"nameEn"`
	ExpectedName   string `json:"expectedName"`
	ExpectedNameEn string `json:"expectedNameEn"`
}

func validCatalogueName(value string) bool {
	return strings.TrimSpace(value) == value && value != "" && len([]rune(value)) <= 160
}

// Group labels belong to a collection/code, independently of variants and occupancy.
func saveMapModelGroup(ctx context.Context, tx pgx.Tx, m battlemap.Model, rename bool) error {
	if m.GroupName == "" && m.GroupNameEn == "" {
		return nil
	}
	if !validCatalogueName(m.GroupName) || !validCatalogueName(m.GroupNameEn) {
		return ErrInvalidMapModels
	}
	conflict := "DO NOTHING"
	if rename {
		conflict = "DO UPDATE SET name=EXCLUDED.name,name_en=EXCLUDED.name_en"
	}
	_, err := tx.Exec(ctx, `INSERT INTO dndshare.map_model_group(collection,code,name,name_en) VALUES($1,$2,$3,$4)
        ON CONFLICT(collection,code) `+conflict, m.Collection, m.Code, m.GroupName, m.GroupNameEn)
	return err
}

// Only catalogue labels/categories are patched. Asset, geometry and behaviour writers
// can run concurrently; stale catalogue edits reject the entire transaction.
func (s *Store) UpdateMapModelCatalogue(ctx context.Context, models []ModelCatalogueChange, groups []ModelGroupNames) error {
	if len(models)+len(groups) == 0 || len(models) > 1000 || len(groups) > 1000 {
		return ErrInvalidMapModels
	}
	models = append([]ModelCatalogueChange(nil), models...)
	groups = append([]ModelGroupNames(nil), groups...)
	sort.Slice(models, func(i, j int) bool { return models[i].DefinitionID < models[j].DefinitionID })
	sort.Slice(groups, func(i, j int) bool {
		return groups[i].Collection+":"+groups[i].Code < groups[j].Collection+":"+groups[j].Code
	})
	seen := map[string]bool{}
	for _, c := range models {
		if c.DefinitionID == "" || len(c.DefinitionID) > 512 || seen[c.DefinitionID] || !validCatalogueName(c.Name) || !validCatalogueName(c.NameEn) || !battlemap.ValidModelCategory(c.Category) || !battlemap.ValidModelGroupCode(c.Code) || c.Code != c.Expected.Code {
			return ErrInvalidMapModels
		}
		seen[c.DefinitionID] = true
	}
	seen = map[string]bool{}
	for _, g := range groups {
		key := g.Collection + ":" + g.Code
		if g.Collection == "" || len(g.Collection) > 80 || seen[key] || !battlemap.ValidModelGroupCode(g.Code) || !validCatalogueName(g.Name) || !validCatalogueName(g.NameEn) {
			return ErrInvalidMapModels
		}
		seen[key] = true
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	// A single SQL batch avoids one network round-trip per model.
	if len(models) > 0 {
		raw, _ := json.Marshal(models)
		rows, err := tx.Query(ctx, `SELECT d.id,m.name,m.name_en,m.category,d.code FROM dndshare.map_model m JOIN dndshare.map_model_definition d ON d.id=m.definition_id
            JOIN jsonb_to_recordset(CAST($1 AS jsonb)) input("definitionId" text) ON d.id=input."definitionId" ORDER BY d.id FOR UPDATE OF d,m`, json.RawMessage(raw))
		if err != nil {
			return err
		}
		current := map[string]ModelCatalogueValue{}
		for rows.Next() {
			var id string
			var value ModelCatalogueValue
			if err = rows.Scan(&id, &value.Name, &value.NameEn, &value.Category, &value.Code); err != nil {
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
		if len(current) != len(models) {
			return ErrNotFound
		}
		for _, c := range models {
			if current[c.DefinitionID] != c.Expected && current[c.DefinitionID] != c.ModelCatalogueValue {
				return ErrMapModelConflict
			}
		}
		if _, err = tx.Exec(ctx, `UPDATE dndshare.map_model m SET name=input.name,name_en=input."nameEn",category=input.category
            FROM jsonb_to_recordset(CAST($1 AS jsonb)) input("definitionId" text,name text,"nameEn" text,category text) WHERE m.definition_id=input."definitionId"`, json.RawMessage(raw)); err != nil {
			return err
		}
	}
	for _, g := range groups {
		// Serializes initial creation as well as renaming an existing group.
		if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, "map-group:"+g.Collection+":"+g.Code); err != nil {
			return err
		}
		var name, nameEn string
		err = tx.QueryRow(ctx, `SELECT name,name_en FROM dndshare.map_model_group WHERE collection=$1 AND code=$2 FOR UPDATE`, g.Collection, g.Code).Scan(&name, &nameEn)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		if (name != g.ExpectedName || nameEn != g.ExpectedNameEn) && (name != g.Name || nameEn != g.NameEn) {
			return ErrMapModelConflict
		}
		if err = saveMapModelGroup(ctx, tx, battlemap.Model{ModelMetadata: battlemap.ModelMetadata{Collection: g.Collection, Code: g.Code, GroupName: g.Name, GroupNameEn: g.NameEn}}, true); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
