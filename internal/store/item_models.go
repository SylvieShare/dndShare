package store

import (
	"context"
	"errors"
)

type ItemModelBinding struct {
	ItemID    int64  `json:"itemId"`
	ModelID   string `json:"modelId"`
	Default   bool   `json:"default"`
	SortOrder int    `json:"sortOrder"`
}

func (s *Store) ListItemModels(ctx context.Context, itemID int64) ([]ItemModelBinding, error) {
	rows, err := s.pool.Query(ctx, `SELECT b.item_id,b.model_id::text,b.is_default,b.sort_order
        FROM dndshare.item_model b JOIN dndshare.item i ON i.id=b.item_id
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
	err = tx.QueryRow(ctx, `SELECT id FROM dndshare.item WHERE id=$1 AND user_id IS NULL AND NOT hidden FOR UPDATE`, b.ItemID).Scan(&id)
	if err != nil {
		return err
	}
	var kind string
	if err = tx.QueryRow(ctx, `SELECT tile_type FROM dndshare.map_model WHERE id=$1::uuid`, b.ModelID).Scan(&kind); err != nil {
		return err
	}
	if kind != "object" {
		return errors.New("item models must use object geometry")
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
