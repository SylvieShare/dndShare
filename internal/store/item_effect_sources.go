package store

import "context"

// Effect sources are author-maintained references stored on the effect.
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
FROM dndshare.item e
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e.data->'application_sources')='array' THEN e.data->'application_sources' ELSE '[]'::jsonb END) WITH ORDINALITY l(link,ordinal)
JOIN dndshare.item i ON i.id=CASE WHEN COALESCE(link#>>'{item,id}',link->>'item') ~ '^[0-9]{1,18}$' THEN COALESCE(link#>>'{item,id}',link->>'item')::bigint END
WHERE e.id=$2 AND e.type_id=15 AND (e.user_id IS NULL OR e.user_id=$1)
 AND (i.user_id IS NULL OR i.user_id=$1)
ORDER BY ordinal LIMIT $3 OFFSET $4`, userID, effectID, limit, offset)
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
