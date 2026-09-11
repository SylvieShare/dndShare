package store

import "context"

// Effect sources are derived from current item links across all handbooks.
// Both the effect and its sources must be visible to the reader.
type ItemEffectSource struct {
	ItemID    int64  `json:"itemId"`
	Key       string `json:"key"`
	Target    string `json:"target"`
	Condition string `json:"condition"`
}

func (s *Store) FindItemEffectSources(ctx context.Context, userID *int64, effectID int64, limit, offset int) ([]ItemEffectSource, error) {
	rows, err := s.pool.Query(ctx, `
SELECT i.id, COALESCE(NULLIF(link->>'key',''),ordinal::text),
 COALESCE(link->>'target','self'), COALESCE(link->>'condition','')
FROM dndshare.item i
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.data->'status_effects')='array'
 THEN i.data->'status_effects' ELSE '[]'::jsonb END) WITH ORDINALITY AS links(link,ordinal)
WHERE (i.user_id IS NULL OR i.user_id=$1)
 AND COALESCE(link#>>'{effect,id}',link->>'effect')=$2::bigint::text
 AND EXISTS(SELECT 1 FROM dndshare.item e WHERE e.id=$2 AND e.type_id=15 AND (e.user_id IS NULL OR e.user_id=$1))
ORDER BY i.name,i.id,ordinal LIMIT $3 OFFSET $4`, userID, effectID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []ItemEffectSource{}
	for rows.Next() {
		var entry ItemEffectSource
		if err := rows.Scan(&entry.ItemID, &entry.Key, &entry.Target, &entry.Condition); err != nil {
			return nil, err
		}
		result = append(result, entry)
	}
	return result, rows.Err()
}
