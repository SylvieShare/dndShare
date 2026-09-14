package store

import (
	"context"
	"encoding/json"
	"testing"
)

// Runs against the disposable database fixture in TestItemAutomationPersistence.
func testHiddenItemVisibility(t *testing.T, s *Store) {
	t.Helper()
	ctx := context.Background()
	on, off := true, false
	data := json.RawMessage(`{}`)
	create := func(name string, typeID int64, parent *int64, hidden *bool) Item {
		t.Helper()
		item, err := s.CreateBase(ctx, name, name, data, typeID, parent, ItemMetadataPatch{Hidden: hidden})
		if err != nil {
			t.Fatal(err)
		}
		return item
	}
	visible := create("ZZ Visible", 9, nil, nil)
	hidden := create("AA Hidden", 9, nil, &on)
	if !hidden.Hidden || visible.Hidden {
		t.Fatal("create returned wrong visibility")
	}
	for _, uid := range []*int64{nil, new(int64)} {
		rows, err := s.GetByTypeAndUser(ctx, 9, uid, 1, 0, nil, ContentScope{})
		if err != nil || len(rows) != 1 || rows[0].ID != visible.ID {
			t.Fatalf("list before pagination: %+v, %v", rows, err)
		}
		rows, err = s.SearchByTypeAndName(ctx, 9, "Hidden", uid, 20, 0, nil, ContentScope{})
		if err != nil || len(rows) != 0 {
			t.Fatalf("hidden search result: %+v, %v", rows, err)
		}
		rows, err = s.SearchByTypesAndName(ctx, []int64{9, 17}, "Hidden", uid, ContentScope{})
		if err != nil || len(rows) != 0 {
			t.Fatalf("hidden multi-search result: %+v, %v", rows, err)
		}
	}
	count, err := s.VisibleItemTypeCount(ctx, 9, nil)
	if err != nil || count != 1 {
		t.Fatalf("hidden rows counted: %d, %v", count, err)
	}
	// Migration hides the two incomplete classes, but stable ID reads survive.
	for _, name := range []string{"Magus", "Shaman"} {
		item, err := s.FindBaseByTypeAndNameEn(ctx, 9, name)
		if err != nil || !item.Hidden {
			t.Fatalf("migration did not hide %s: %+v, %v", name, item, err)
		}
		rows, err := s.GetByIds(ctx, []int64{item.ID}, nil)
		if err != nil || len(rows) != 1 || !rows[0].Hidden {
			t.Fatalf("existing character lookup: %+v, %v", rows, err)
		}
	}
	child := create("Child", 17, &visible.ID, &on)
	rows, err := s.FindChildren(ctx, visible.ID, nil, ContentScope{})
	if err != nil || len(rows) != 0 {
		t.Fatalf("hidden child visible: %+v, %v", rows, err)
	}
	rows, err = s.GetByIds(ctx, []int64{visible.ID}, nil)
	if err != nil || len(rows) != 1 {
		t.Fatal(err)
	}
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(rows[0].Data, &obj); err != nil {
		t.Fatal(err)
	}
	if string(obj["subclasses"]) != "[]" {
		t.Fatalf("hidden child in relation: %s", obj["subclasses"])
	}
	if err := s.Update(ctx, child.ID, 0, true, child.Name, child.NameEn, data, ItemMetadataPatch{}); err != nil {
		t.Fatal(err)
	}
	rows, err = s.GetByIds(ctx, []int64{child.ID}, nil)
	if err != nil || len(rows) != 1 || !rows[0].Hidden {
		t.Fatalf("omitted hidden was reset: %+v, %v", rows, err)
	}
	if err := s.Update(ctx, child.ID, 0, true, child.Name, child.NameEn, data, ItemMetadataPatch{Hidden: &off}); err != nil {
		t.Fatal(err)
	}
	rows, err = s.FindChildren(ctx, visible.ID, nil, ContentScope{})
	if err != nil || len(rows) != 1 || rows[0].Hidden {
		t.Fatalf("explicit unhide failed: %+v, %v", rows, err)
	}
	own, err := s.Create(ctx, 42, "Private hidden", data, 9, nil, ItemMetadataPatch{Hidden: &on})
	if err != nil || !own.Hidden {
		t.Fatalf("private hidden create: %+v, %v", own, err)
	}
	rows, err = s.GetByIds(ctx, []int64{own.ID}, nil)
	if err != nil || len(rows) != 0 {
		t.Fatalf("hidden bypassed ownership: %+v, %v", rows, err)
	}
}
