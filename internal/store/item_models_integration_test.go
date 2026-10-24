package store

import (
	"errors"
	"fmt"
	"testing"
)

func TestItemModelsPostgres(t *testing.T) {
	pool := currentSchemaTestPool(t)
	seedTestUsers(t, pool, 1)
	seedTestItemTypes(t, pool, 6)
	s := &Store{pool: pool}
	seedMapModelsForTest(t, s)
	schemaTestExec(t, pool, `INSERT INTO dndshare.item(id,user_id,custom_source_id,name,type_id,data,hidden) VALUES
 (1635,NULL,NULL,'Public',6,'{}',false),(1636,NULL,NULL,'Shared',6,'{}',false),
 (1637,1,(SELECT id FROM dndshare.custom_item_source WHERE user_id=1 AND is_default),'Private',6,'{}',false),
 (1638,NULL,NULL,'Hidden',6,'{}',true)`)
	models, err := s.ListMapModels(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	for i := range 2 {
		m := models[0]
		m.ID = fmt.Sprintf("91000000-0000-4000-8000-%012d", i+1)
		m.SourceCode = fmt.Sprintf("ITEM-%d", i)
		m.SourceName = fmt.Sprintf("Item model %d", i)
		m.TileType = "object"
		m.Category = "object"
		m.ReferenceDiameter = .9
		m.Hidden = true // Palette hiding must not hide a public item's miniature.
		if _, err = s.RegisterMapModel(t.Context(), m); err != nil {
			t.Fatal(err)
		}
	}
	models, err = s.ListMapModels(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	objects := []string{}
	floor := ""
	for _, m := range models {
		if m.TileType == "object" {
			m.ReferenceDiameter = .9
			if _, err = s.RegisterMapModel(t.Context(), m); err != nil {
				t.Fatal(err)
			}
			objects = append(objects, m.ID)
		} else {
			floor = m.ID
		}
	}
	if len(objects) < 2 {
		t.Fatal("two object fixtures required")
	}
	first := ItemModelBinding{ItemID: 1635, ModelID: objects[0], Default: true}
	second := ItemModelBinding{ItemID: 1635, ModelID: objects[1], Default: true, SortOrder: 1}
	for _, b := range []ItemModelBinding{first, first, second} {
		if err = s.BindItemModel(t.Context(), b); err != nil {
			t.Fatal(err)
		}
	}
	bindings, err := s.ListItemModels(t.Context(), 1635)
	if err != nil || len(bindings) != 2 || bindings[0].ModelID != objects[1] || !bindings[0].Default || bindings[1].Default {
		t.Fatalf("default replacement/idempotency: %+v %v", bindings, err)
	}
	shared := second
	shared.ItemID = 1636
	if err = s.BindItemModel(t.Context(), shared); err != nil {
		t.Fatal(err)
	}
	preferred, err := s.PreferredItemModels(t.Context())
	if err != nil || len(preferred[objects[1]]) != 2 {
		t.Fatalf("shared asset binding: %+v %v", preferred, err)
	}
	visible, err := s.attachItemModels(t.Context(), []Item{{ID: 1635, TypeID: 6}, {ID: 1636, TypeID: 1}, {ID: 1638, Hidden: true}, {ID: 999}})
	if err != nil || visible[0].ModelID != objects[1] || visible[1].ModelID != objects[1] || visible[2].ModelID != "" || visible[3].ModelID != "" {
		t.Fatalf("batched model presence across item types: %+v %v", visible, err)
	}
	model, err := s.GetItemModel(t.Context(), 1635)
	if err != nil || model.ID != objects[1] {
		t.Fatalf("handbook preferred model differs from map selection: %+v %v", model, err)
	}
	for _, id := range []int64{1637, 1638, 999} {
		if _, err := s.GetItemModel(t.Context(), id); !errors.Is(err, ErrNotFound) {
			t.Fatalf("private/hidden/missing item %d exposed a model: %v", id, err)
		}
	}
	for _, b := range []ItemModelBinding{{ItemID: 1637, ModelID: objects[0]}, {ItemID: 1638, ModelID: objects[0]}, {ItemID: 1635, ModelID: floor, Default: true}} {
		if err = s.BindItemModel(t.Context(), b); err == nil {
			t.Fatal("accepted private, hidden or tile model binding", b)
		}
	}
	if err = s.UnbindItemModel(t.Context(), 1635, objects[1]); err != nil {
		t.Fatal(err)
	}
	preferred, err = s.PreferredItemModels(t.Context())
	if err != nil || len(preferred[objects[0]]) != 1 {
		t.Fatalf("deterministic fallback: %+v %v", preferred, err)
	}
	schemaTestExec(t, pool, `DELETE FROM dndshare.item WHERE id=1635`)
	bindings, err = s.ListItemModels(t.Context(), 1635)
	if err != nil || len(bindings) != 0 {
		t.Fatal("binding did not cascade", bindings, err)
	}
	if _, err = s.GetMapModel(t.Context(), objects[0]); err != nil {
		t.Fatal("item removal deleted shared asset", err)
	}
}
