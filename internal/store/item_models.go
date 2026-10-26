package store

import (
	"context"
	"errors"

	"dndshare/internal/battlemap"
)

type ItemModelBinding struct {
	ItemID    int64  `json:"itemId"`
	ModelID   string `json:"modelId"`
	Default   bool   `json:"default"`
	SortOrder int    `json:"sortOrder"`
}

// Resolve only a public item's preferred binding, using the same ordering as maps.
func (s *Store) GetItemModel(ctx context.Context, itemID int64) (battlemap.Model, error) {
	return scanMapModel(s.pool.QueryRow(ctx, `SELECT `+mapModelColumns+` FROM dndshare.map_model
        WHERE id=(SELECT b.model_id FROM dndshare.item_model b
          JOIN dndshare.active_item i ON i.id=b.item_id
          WHERE b.item_id=$1 AND i.user_id IS NULL AND NOT i.hidden
          ORDER BY b.is_default DESC,b.sort_order,b.model_id LIMIT 1)`, itemID))
}

// Presence travels with item reads; the handbook never loads the map catalogue
// or sends one metadata request per visible item to decide whether to show 3D.
func (s *Store) attachItemModels(ctx context.Context, items []Item) ([]Item, error) {
	ids := make([]int64, 0, len(items))
	for index, item := range items {
		items[index].ModelID = ""
		if item.UserID == nil && !item.Hidden {
			ids = append(ids, item.ID)
		}
	}
	if len(ids) == 0 {
		return items, nil
	}
	rows, err := s.pool.Query(ctx, `SELECT DISTINCT ON(b.item_id) b.item_id,b.model_id::text
        FROM dndshare.item_model b JOIN dndshare.active_item i ON i.id=b.item_id
        WHERE b.item_id=ANY($1::bigint[]) AND i.user_id IS NULL AND NOT i.hidden
        ORDER BY b.item_id,b.is_default DESC,b.sort_order,b.model_id`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	preferred := map[int64]string{}
	for rows.Next() {
		var id int64
		var model string
		if err := rows.Scan(&id, &model); err != nil {
			return nil, err
		}
		preferred[id] = model
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for index := range items {
		items[index].ModelID = preferred[items[index].ID]
	}
	return items, nil
}

func (s *Store) ListItemModels(ctx context.Context, itemID int64) ([]ItemModelBinding, error) {
	rows, err := s.pool.Query(ctx, `SELECT b.item_id,b.model_id::text,b.is_default,b.sort_order
        FROM dndshare.item_model b JOIN dndshare.active_item i ON i.id=b.item_id
        WHERE i.user_id IS NULL AND NOT i.hidden AND ($1::bigint=0 OR b.item_id=$1)
        ORDER BY b.item_id,b.is_default DESC,b.sort_order,b.model_id`, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []ItemModelBinding{}
	for rows.Next() {
		var b ItemModelBinding
		if err = rows.Scan(&b.ItemID, &b.ModelID, &b.Default, &b.SortOrder); err != nil {
			return nil, err
		}
		result = append(result, b)
	}
	return result, rows.Err()
}

func (s *Store) PreferredItemModels(ctx context.Context) (map[string][]int64, error) {
	bindings, err := s.ListItemModels(ctx, 0)
	if err != nil {
		return nil, err
	}
	result := map[string][]int64{}
	seen := map[int64]bool{}
	for _, b := range bindings {
		if !seen[b.ItemID] {
			result[b.ModelID] = append(result[b.ModelID], b.ItemID)
			seen[b.ItemID] = true
		}
	}
	return result, nil
}

func (s *Store) BindItemModel(ctx context.Context, b ItemModelBinding) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var id int64
	err = tx.QueryRow(ctx, `SELECT id FROM dndshare.active_item WHERE id=$1 AND user_id IS NULL AND NOT hidden FOR UPDATE`, b.ItemID).Scan(&id)
	if err != nil {
		return err
	}
	var kind, category string
	var diameter float64
	if err = tx.QueryRow(ctx, `SELECT tile_type,category,COALESCE((geometry->>'referenceDiameter')::float8,0) FROM dndshare.map_model WHERE id=$1::uuid`, b.ModelID).Scan(&kind, &category, &diameter); err != nil {
		return err
	}
	if kind != "object" || category == "creature-base" {
		return errors.New("item models must use object geometry")
	}
	if diameter <= 0 || diameter > 32 {
		return errors.New("item models require a calibrated referenceDiameter")
	}
	if b.Default {
		if _, err = tx.Exec(ctx, `UPDATE dndshare.item_model SET is_default=false WHERE item_id=$1 AND is_default`, b.ItemID); err != nil {
			return err
		}
	}
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.item_model(item_id,model_id,is_default,sort_order) VALUES($1,$2::uuid,$3,$4)
        ON CONFLICT(item_id,model_id) DO UPDATE SET is_default=EXCLUDED.is_default,sort_order=EXCLUDED.sort_order`, b.ItemID, b.ModelID, b.Default, b.SortOrder)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) UnbindItemModel(ctx context.Context, itemID int64, modelID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM dndshare.item_model WHERE item_id=$1 AND model_id=$2::uuid`, itemID, modelID)
	return err
}
