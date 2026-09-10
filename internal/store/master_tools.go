package store

import (
	"context"
	"strings"
)

// TreasurePool includes only explicitly opted-in public or own equipment.
func (s *Store) TreasurePool(ctx context.Context, userID int64, scope ContentScope) ([]Item, error) {
	args := []any{userID}
	where := []string{publicOrOwnedPredicate("i", &userID, 1),
		"i.type_id IN (1,2,10,12,13,14,19)", "jsonb_typeof(i.data->'treasure')='object'"}
	where = appendContentScopeSQL(where, &args, scope)
	rows, err := s.pool.Query(ctx, "SELECT "+itemSelectColumns("i")+" FROM dndshare.item i "+itemMediaJoins("i")+" WHERE "+strings.Join(where, " AND ")+" ORDER BY i.id", args...)
	if err != nil {
		return nil, err
	}
	items, err := collectItems(rows)
	if err != nil {
		return nil, err
	}
	return s.attachItemReadMetadata(ctx, items, &userID)
}
