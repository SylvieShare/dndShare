package store

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
)

func applyEditionImport(ctx context.Context, tx pgx.Tx, req EditionImportRequest, existing map[string]bool, fingerprints map[string]string, result *EditionImportResult) error {
	// Allocate stable IDs first so every symbolic reference can be resolved,
	// including references to records appearing later in the package.
	rows, err := tx.Query(ctx, `SELECT nextval(pg_get_serial_sequence('dndshare.item','id')) FROM generate_series(1,$1::int)`, result.Created)
	if err != nil {
		return err
	}
	allocated := []int64{}
	for rows.Next() {
		var id int64
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		allocated = append(allocated, id)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return err
	}
	cursor := 0
	for _, r := range req.Records {
		if !existing[r.Key] {
			result.IDs[r.Key] = allocated[cursor]
			cursor++
		}
	}
	// Parent triggers need base records to have been inserted first. Batches are
	// separated by type group, with all data refs already pointing to final IDs.
	groups := [][]EditionImportRecord{{}, {}, {}}
	for _, r := range req.Records {
		if !existing[r.Key] {
			group := 2
			if r.TypeID == 8 || r.TypeID == 9 {
				group = 0
			}
			if r.TypeID == 16 || r.TypeID == 17 {
				group = 1
			}
			groups[group] = append(groups[group], r)
		}
	}
	for _, group := range groups {
		batch := &pgx.Batch{}
		for _, r := range group {
			resolved, err := resolveImportRefs(r.Data, result.IDs)
			if err != nil {
				return err
			}
			data := resolved.(map[string]any)
			data["edition_key"] = r.Key
			data["import_fingerprint"] = fingerprints[r.Key]
			raw, err := json.Marshal(data)
			if err != nil {
				return err
			}
			var parent *int64
			if r.ParentKey != "" {
				id := result.IDs[r.ParentKey]
				parent = &id
			}
			var kind *string
			if r.OriginalID != nil {
				v := "revision"
				kind = &v
			}
			batch.Queue(`INSERT INTO dndshare.item(id,name,name_en,type_id,data,parent_id,derived_from_item_id,derivation_kind,automation_status,automation_note,icon_image_id,icon_svg_id,cover_image_id) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,(SELECT icon_image_id FROM dndshare.item WHERE id=$7),(SELECT icon_svg_id FROM dndshare.item WHERE id=$7),(SELECT cover_image_id FROM dndshare.item WHERE id=$7))`, result.IDs[r.Key], r.Name, r.NameEn, r.TypeID, string(raw), parent, r.OriginalID, kind, r.AutomationStatus, r.AutomationNote)
		}
		br := tx.SendBatch(ctx, batch)
		for range group {
			if _, err = br.Exec(); err != nil {
				br.Close()
				return err
			}
		}
		if err = br.Close(); err != nil {
			return err
		}
	}
	ids := []int64{}
	replacements := map[int64][]int64{}
	for _, r := range req.Records {
		id := result.IDs[r.Key]
		ids = append(ids, id)
		if !existing[r.Key] && r.OriginalID != nil {
			replacements[*r.OriginalID] = append(replacements[*r.OriginalID], id)
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO dndshare.item_content_source(item_id,content_source_id) SELECT unnest($1::bigint[]),$2 ON CONFLICT DO NOTHING`, append(append([]int64{}, ids...), req.Reprints...), req.ContentSourceID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status,note) SELECT unnest($1::bigint[]),$2,'native','Отдельная версия из публикации' ON CONFLICT DO NOTHING`, ids, req.SourceVersionID); err != nil {
		return err
	}
	for _, d := range req.Decisions {
		if _, err = tx.Exec(ctx, `INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status,note) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, d.ID, req.SourceVersionID, d.Status, d.Note); err != nil {
			return err
		}
		ids = append(ids, d.ID)
	}
	for old, targets := range replacements {
		var target *int64
		note := "Используйте отдельную версию этой записи из новой публикации."
		if len(targets) == 1 {
			target = &targets[0]
		} else {
			note = fmt.Sprintf("В новой публикации %d вариантов по классу или контексту; выберите соответствующий.", len(targets))
		}
		if _, err = tx.Exec(ctx, `INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status,replaced_by_item_id,note) VALUES($1,$2,'legacy',$3,$4) ON CONFLICT DO NOTHING`, old, req.SourceVersionID, target, note); err != nil {
			return err
		}
	}
	if err = validateParentEditions(ctx, tx, ids); err != nil {
		return err
	}
	return nil
}
