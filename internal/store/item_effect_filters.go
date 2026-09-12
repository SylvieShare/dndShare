package store

import "strings"

// Source groups may overlap: a standard condition can also be applied by a spell
// or magic item. Only sources visible to the reader contribute to membership.
func effectSourceFilterSQL(values []any, userID *int64, add func(any) string) string {
	parts := []string{}
	typeIDs := []int64{}
	for _, value := range values {
		switch value {
		case "basic":
			parts = append(parts, `i.data->>'code' IN ('blinded','charmed','deafened','frightened',
 'grappled','incapacitated','invisible','paralyzed','petrified','poisoned','prone',
 'restrained','stunned','unconscious','exhaustion','inspiration')`)
		case "magic_item":
			typeIDs = append(typeIDs, 19)
		case "spell":
			typeIDs = append(typeIDs, 5)
		}
	}
	if len(typeIDs) > 0 {
		visibility := "source.user_id IS NULL"
		if userID != nil {
			visibility = "(" + visibility + " OR source.user_id = " + add(*userID) + ")"
		}
		parts = append(parts, `EXISTS (SELECT 1 FROM dndshare.item source
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(source.data->'status_effects')='array'
 THEN source.data->'status_effects' ELSE '[]'::jsonb END) link
 WHERE source.type_id = ANY(`+add(typeIDs)+`::bigint[]) AND `+visibility+`
 AND COALESCE(link#>>'{effect,id}',link->>'effect') = i.id::text)`)
	}
	if len(parts) == 0 {
		return "FALSE"
	}
	return "(" + strings.Join(parts, " OR ") + ")"
}
