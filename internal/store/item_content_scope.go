package store

import "fmt"

// Edition decisions and publication selection are independent. In particular,
// private/unassigned items still need an explicit decision for the edition.
func appendContentScopeSQL(where []string, args *[]any, scope ContentScope) []string {
	add := func(value any) string {
		*args = append(*args, value)
		return fmt.Sprintf("$%d", len(*args))
	}
	if scope.SourceVersionID != nil {
		statuses := "('native','compatible')"
		if scope.AllowLegacy {
			statuses = "('native','compatible','legacy','requires_adaptation')"
		}
		where = append(where, `EXISTS (SELECT 1 FROM dndshare.item_version_compatibility ivc
   WHERE ivc.item_id=i.id AND ivc.source_version_id=`+add(*scope.SourceVersionID)+` AND ivc.status IN `+statuses+`)`)
	}
	if scope.RestrictToIDs {
		selected := "FALSE"
		if len(scope.IDs) > 0 {
			selected = "ics.content_source_id = ANY(" + add(scope.IDs) + ")"
		}
		where = append(where, `(i.user_id IS NOT NULL OR NOT EXISTS
   (SELECT 1 FROM dndshare.item_content_source unassigned WHERE unassigned.item_id=i.id)
   OR EXISTS (SELECT 1 FROM dndshare.item_content_source ics WHERE ics.item_id=i.id AND `+selected+`))`)
	}
	return where
}
