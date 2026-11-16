package store

import (
	"context"
	"dndshare/internal/cyberpunkred"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"sort"
)

type RedInstallResult struct {
	Revision   string `json:"revision"`
	Hash       string `json:"hash"`
	SourceID   int64  `json:"sourceId"`
	VersionID  int64  `json:"sourceVersionId"`
	TemplateID int64  `json:"templateId"`
	Items      int    `json:"items"`
	Created    int    `json:"created"`
	Preview    bool   `json:"preview"`
}

// Import is an explicit operator action, scoped to one system. Existing records
// are preserved, including editorial changes; repeated installation is a no-op.
func (s *Store) InstallRedCatalogue(ctx context.Context, hash string, apply bool) (RedInstallResult, error) {
	core, err := cyberpunkred.Core()
	if err != nil {
		return RedInstallResult{}, err
	}
	result := RedInstallResult{Revision: core.Revision, Hash: cyberpunkred.CoreHash(), Items: len(core.Items), Preview: !apply}
	if hash != result.Hash {
		return result, fmt.Errorf("catalogue hash mismatch; preview the package first")
	}
	if !apply {
		return result, nil
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(744349807)`); err != nil {
		return result, err
	}
	ensure := func(selectSQL, insertSQL string, args ...any) (int64, error) {
		var id int64
		e := tx.QueryRow(ctx, selectSQL, args...).Scan(&id)
		if errors.Is(e, pgx.ErrNoRows) {
			e = tx.QueryRow(ctx, insertSQL, args...).Scan(&id)
		}
		return id, e
	}
	result.SourceID, err = ensure(`SELECT id FROM dndshare.source WHERE name=$1`, `INSERT INTO dndshare.source(name) VALUES($1) RETURNING id`, "Cyberpunk")
	if err != nil {
		return result, err
	}
	result.VersionID, err = ensure(`SELECT id FROM dndshare.source_version WHERE source_id=$1 AND version=$2`, `INSERT INTO dndshare.source_version(source_id,version) VALUES($1,$2) RETURNING id`, result.SourceID, "RED")
	if err != nil {
		return result, err
	}
	result.TemplateID, err = ensure(`SELECT id FROM dndshare.char_template WHERE name=$1`, `INSERT INTO dndshare.char_template(name) VALUES($1) RETURNING id`, "CYBERPUNK_RED")
	if err != nil {
		return result, err
	}
	var bookID int64
	err = tx.QueryRow(ctx, `SELECT id FROM dndshare.content_source WHERE source_id=$1 AND code='CPR'`, result.SourceID).Scan(&bookID)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `INSERT INTO dndshare.content_source(source_id,native_source_version_id,name,code,kind,is_default) VALUES($1,$2,'Cyberpunk RED — основная книга','CPR','core',true) RETURNING id`, result.SourceID, result.VersionID).Scan(&bookID)
	}
	if err != nil {
		return result, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.content_source_compatibility(content_source_id,source_version_id,status) VALUES($1,$2,'native') ON CONFLICT DO NOTHING`, bookID, result.VersionID)
	if err != nil {
		return result, err
	}
	groups := make([]string, 0, len(core.Groups))
	for k := range core.Groups {
		groups = append(groups, k)
	}
	sort.Strings(groups)
	types := map[string]int64{}
	for _, key := range groups {
		name := core.Groups[key]
		var id int64
		err = tx.QueryRow(ctx, `SELECT id FROM dndshare.item_type WHERE source_id=$1 AND name=$2`, result.SourceID, name).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			fields := redCatalogueFields(core.Items, key)
			err = tx.QueryRow(ctx, `INSERT INTO dndshare.item_type(name,source_id,fields,description,important) VALUES($1,$2,$3::jsonb,$4,true) RETURNING id`, name, result.SourceID, rawCharacterJSON(fields), "Cyberpunk RED · Core").Scan(&id)
		}
		if err != nil {
			return result, err
		}
		types[key] = id
	}
	for _, item := range core.Items {
		var id int64
		err = tx.QueryRow(ctx, `SELECT id FROM dndshare.item WHERE type_id=$1 AND user_id IS NULL AND data->>'red_key'=$2 AND NOT deleted`, types[item.Category], item.Key).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			data := map[string]any{"red_key": item.Key, "red_kind": item.Kind, "red_revision": core.Revision, "facts": item.Facts, "description": fmt.Sprintf("%s Cyberpunk RED, стр. %d.", item.Summary, item.Page)}
			err = tx.QueryRow(ctx, `INSERT INTO dndshare.item(name,name_en,type_id,data,automation_status,automation_note) VALUES($1,$2,$3,$4::jsonb,'partial','Числовые параметры доступны в листе; условия и решения ведущего указаны в источнике.') RETURNING id`, item.Name, item.NameEn, types[item.Category], rawCharacterJSON(data)).Scan(&id)
			if err == nil {
				result.Created++
			}
		}
		if err != nil {
			return result, err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO dndshare.item_content_source(item_id,content_source_id,page,primary_source) VALUES($1,$2,$3,true) ON CONFLICT DO NOTHING`, id, bookID, item.Page); err != nil {
			return result, err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status) VALUES($1,$2,'native') ON CONFLICT DO NOTHING`, id, result.VersionID); err != nil {
			return result, err
		}
	}
	for name, entries := range core.Dictionaries {
		id, e := ensure(`SELECT id FROM dndshare.suggest_type WHERE source_id=$1 AND name=$2`, `INSERT INTO dndshare.suggest_type(source_id,name) VALUES($1,$2) RETURNING id`, result.SourceID, name)
		if e != nil {
			return result, e
		}
		for _, entry := range entries {
			_, e = tx.Exec(ctx, `INSERT INTO dndshare.suggest(type_id,value,code,"desc") SELECT $1,$2,$3,$4 WHERE NOT EXISTS(SELECT 1 FROM dndshare.suggest WHERE type_id=$1 AND code=$3 AND user_id IS NULL)`, id, entry.Name, entry.Key, entry.Description)
			if e != nil {
				return result, e
			}
		}
	}
	return result, tx.Commit(ctx)
}

func (s *Store) RedCatalogue(ctx context.Context, userID *int64) ([]Item, error) {
	rows, err := s.pool.Query(ctx, `SELECT i.id FROM dndshare.active_item i JOIN dndshare.item_type t ON t.id=i.type_id JOIN dndshare.source s ON s.id=t.source_id WHERE s.name='Cyberpunk' AND NOT i.hidden AND (i.user_id IS NULL OR i.user_id=$1) ORDER BY i.id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []int64{}
	for rows.Next() {
		var id int64
		if err = rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	return s.GetByIds(ctx, ids, userID)
}
