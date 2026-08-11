package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

// ContentSource is a publication/content pack. NativeSourceVersionID tells
// which rules edition it was written for; CompatibilityStatus is effective for
// the target edition requested by the client.
type ContentSource struct {
	ID                    int64   `json:"id"`
	SourceID              int64   `json:"sourceId"`
	NativeSourceVersionID *int64  `json:"nativeSourceVersionId,omitempty"`
	NativeVersion         *string `json:"nativeVersion,omitempty"`
	Name                  string  `json:"name"`
	Code                  string  `json:"code"`
	Description           *string `json:"description,omitempty"`
	Kind                  string  `json:"kind"`
	IsDefault             bool    `json:"isDefault"`
	SortOrder             int     `json:"sortOrder"`
	CompatibilityStatus   string  `json:"compatibilityStatus"`
}

type ContentSourceRef struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
}

// ContentScope limits catalogue queries for a character/wizard. Empty IDs mean
// "all sources". User-authored and deliberately unclassified global items
// remain visible independently of publication filters.
type ContentScope struct {
	IDs             []int64
	RestrictToIDs   bool
	SourceVersionID *int64
	AllowLegacy     bool
}

func scanContentSource(row pgx.Row) (ContentSource, error) {
	var cs ContentSource
	err := row.Scan(&cs.ID, &cs.SourceID, &cs.NativeSourceVersionID, &cs.NativeVersion,
		&cs.Name, &cs.Code, &cs.Description, &cs.Kind, &cs.IsDefault, &cs.SortOrder,
		&cs.CompatibilityStatus)
	return cs, err
}

// GetContentSources returns sources for a game system, optionally evaluated
// against one concrete rules edition. Blocked sources are omitted.
func (s *Store) GetContentSources(ctx context.Context, sourceID, sourceVersionID *int64) ([]ContentSource, error) {
	args := []any{}
	where := []string{}
	statusExpr := "'compatible'"
	joinTarget := ""
	if sourceVersionID != nil {
		args = append(args, *sourceVersionID)
		joinTarget = `JOIN dndshare.source_version target ON target.id = $1 AND target.source_id = cs.source_id
		LEFT JOIN dndshare.content_source_compatibility csc
		  ON csc.content_source_id = cs.id AND csc.source_version_id = target.id`
		statusExpr = `COALESCE(csc.status,
		  CASE WHEN cs.native_source_version_id = target.id THEN 'native' ELSE 'blocked' END)`
		where = append(where, statusExpr+" <> 'blocked'")
	} else if sourceID != nil {
		args = append(args, *sourceID)
		where = append(where, fmt.Sprintf("cs.source_id = $%d", len(args)))
		statusExpr = `CASE WHEN cs.native_source_version_id IS NULL THEN 'compatible' ELSE 'native' END`
	}
	sql := `SELECT cs.id, cs.source_id, cs.native_source_version_id, native.version,
	               cs.name, cs.code, cs.description, cs.kind, cs.is_default, cs.sort_order,
	               ` + statusExpr + ` AS compatibility_status
	          FROM dndshare.content_source cs
	          LEFT JOIN dndshare.source_version native ON native.id = cs.native_source_version_id
	          ` + joinTarget
	if len(where) > 0 {
		sql += " WHERE " + strings.Join(where, " AND ")
	}
	sql += ` ORDER BY cs.is_default DESC, cs.sort_order, lower(cs.name), cs.id`
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ContentSource{}
	for rows.Next() {
		cs, err := scanContentSource(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, cs)
	}
	return out, rows.Err()
}

func (s *Store) ContentSourceExistsForSystem(ctx context.Context, id, sourceID int64) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM dndshare.content_source WHERE id = $1 AND source_id = $2)`,
		id, sourceID).Scan(&exists)
	return exists, err
}

// SetItemContentSources replaces source links after the caller has authorised
// editing the item. IDs are validated against the item's game system.
func (s *Store) SetItemContentSources(ctx context.Context, itemID, userID int64, isAdmin bool, sourceIDs []int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) // no-op after Commit
	var gameSourceID *int64
	if err := tx.QueryRow(ctx,
		`SELECT it.source_id
		   FROM dndshare.item i
		   JOIN dndshare.item_type it ON it.id = i.type_id
		  WHERE i.id = $1 AND ($3 OR i.user_id = $2)`,
		itemID, userID, isAdmin).Scan(&gameSourceID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM dndshare.item_content_source WHERE item_id = $1`, itemID); err != nil {
		return err
	}
	if gameSourceID != nil {
		seen := map[int64]bool{}
		inserted := 0
		for _, id := range sourceIDs {
			if id <= 0 || seen[id] {
				continue
			}
			seen[id] = true
			result, err := tx.Exec(ctx,
				`INSERT INTO dndshare.item_content_source (item_id, content_source_id, primary_source)
				 SELECT $1, id, $3 FROM dndshare.content_source WHERE id = $2 AND source_id = $4`,
				itemID, id, inserted == 0, *gameSourceID)
			if err != nil {
				return err
			}
			if result.RowsAffected() == 0 {
				return fmt.Errorf("content source %d is not valid for item %d", id, itemID)
			}
			inserted++
		}
	}
	return tx.Commit(ctx)
}

// AttachItemContentSources enriches item DTOs without changing the stable item
// table layout used by the older repository methods.
func (s *Store) AttachItemContentSources(ctx context.Context, items []Item) ([]Item, error) {
	if len(items) == 0 {
		return items, nil
	}
	ids := make([]int64, 0, len(items))
	byID := make(map[int64]int, len(items))
	for i := range items {
		ids = append(ids, items[i].ID)
		byID[items[i].ID] = i
		items[i].ContentSourceIDs = []int64{}
		items[i].ContentSources = []ContentSourceRef{}
	}
	rows, err := s.pool.Query(ctx,
		`SELECT ics.item_id, cs.id, cs.name, cs.code
		   FROM dndshare.item_content_source ics
		   JOIN dndshare.content_source cs ON cs.id = ics.content_source_id
		  WHERE ics.item_id = ANY($1)
		  ORDER BY ics.item_id, ics.primary_source DESC, cs.id`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var itemID, sourceID int64
		var name, code string
		if err := rows.Scan(&itemID, &sourceID, &name, &code); err != nil {
			return nil, err
		}
		if idx, ok := byID[itemID]; ok {
			items[idx].ContentSourceIDs = append(items[idx].ContentSourceIDs, sourceID)
			items[idx].ContentSources = append(items[idx].ContentSources, ContentSourceRef{ID: sourceID, Name: name, Code: code})
		}
	}
	return items, rows.Err()
}
