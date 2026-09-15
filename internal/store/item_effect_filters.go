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
		case "potion":
			typeIDs = append(typeIDs, 10)
		case "spell":
			typeIDs = append(typeIDs, 5)
		}
	}
	if len(typeIDs) > 0 {
		visibility := "source.user_id IS NULL"
		viewer := "NULL::bigint"
		if userID != nil {
			viewer = add(*userID)
			visibility = "(" + visibility + " OR source.user_id = " + viewer + ")"
		}
		parts = append(parts, `EXISTS (SELECT 1
 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(i.data->'application_sources')='array' THEN i.data->'application_sources' ELSE '[]'::jsonb END) ref
 JOIN dndshare.item source ON source.id=CASE WHEN COALESCE(ref#>>'{item,id}',ref->>'item') ~ '^[0-9]{1,18}$' THEN COALESCE(ref#>>'{item,id}',ref->>'item')::bigint END
 WHERE source.type_id = ANY(`+add(typeIDs)+`::bigint[]) AND `+visibility+`)`)
	}
	if len(parts) == 0 {
		return "FALSE"
	}
	return "(" + strings.Join(parts, " OR ") + ")"
}
