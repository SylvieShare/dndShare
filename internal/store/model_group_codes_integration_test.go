package store

import (
	"context"
	"testing"
)

func testModelGroupCodeRules(t *testing.T, ctx context.Context, s *Store) {
	t.Helper()
	cases := []struct{ pack, name, want string }{
		{"ultimate-dungeon", "Door", "UD-door"}, {"ultimate-dungeon", "Door Open", "UD-door"},
		{"ultimate-dungeon", "Ground 1", "UD-ground"}, {"ultimate-dungeon", "Ground 2", "UD-ground"},
		{"ultimate-dungeon", "Ground Symbol Crossbow", "UD-ground-symbol"}, {"ultimate-dungeon", "Ground Symbol Cross 2", "UD-ground-symbol"},
		{"lost-cave", "Wall 1", "LC-wall"}, {"lost-cave", "Wall Angle", "LC-wall-angle"},
		{"ultimate-dungeon", "Level Grid 3X6", "UD-level-grid"},
	}
	for _, c := range cases {
		var actual string
		if err := s.pool.QueryRow(ctx, `SELECT dndshare.map_model_group_code($1,$2)`, c.pack, c.name).Scan(&actual); err != nil || actual != c.want {
			t.Fatalf("%s %s: %s %v", c.pack, c.name, actual, err)
		}
	}
}
