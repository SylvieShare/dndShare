package store

import (
	"context"
	"encoding/json"
)

// Batch explicit references by primary key; never search the catalogue for
// backlinks on a read. Private source ids and conditions are filtered together.
func (s *Store) attachEffectPresentation(ctx context.Context, items []Item, userID *int64) ([]Item, error) {
	documents := map[int]map[string]any{}
	ids := []int64{}
	refID := func(raw any) int64 {
		if value, ok := raw.(map[string]any); ok {
			return int64(number(value["id"]))
		}
		return int64(number(raw))
	}
	for index, item := range items {
		if item.TypeID != 15 {
			continue
		}
		var data map[string]any
		if err := json.Unmarshal(item.Data, &data); err != nil {
			return nil, err
		}
		if data == nil {
			continue
		}
		documents[index] = data
		for _, raw := range array(data["application_sources"]) {
			if id := refID(object(raw)["item"]); id > 0 {
				ids = append(ids, id)
			}
		}
	}
	if len(ids) == 0 {
		return items, nil
	}
	visible := map[int64]bool{}
	rows, err := s.pool.Query(ctx, `SELECT i.id FROM dndshare.item i WHERE i.id=ANY($1) AND (i.user_id IS NULL OR i.user_id=$2)`, ids, userID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id int64
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		visible[id] = true
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	for index, data := range documents {
		if _, exists := data["application_sources"]; exists {
			sources := []any{}
			for _, raw := range array(data["application_sources"]) {
				if _, ok := visible[refID(object(raw)["item"])]; ok {
					sources = append(sources, raw)
				}
			}
			data["application_sources"] = sources
		}
		items[index].Data, err = json.Marshal(data)
		if err != nil {
			return nil, err
		}
	}
	return items, nil
}
