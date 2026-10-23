package store

import (
	"fmt"
	"testing"
)

func TestItemModelsPostgres(t *testing.T) {
	pool := schemaTestPool(t)
	schemaTestExec(t, pool, `CREATE SCHEMA dndshare; CREATE TABLE dndshare.item(id bigint PRIMARY KEY,user_id bigint,hidden boolean NOT NULL DEFAULT false);`)
	schemaTestExec(t, pool, testSchemaTables(t, "map_model", "map_model_definition", "map_model_group", "map_model_transition", "item_model"))
	s := &Store{pool: pool}
	seedMapModelsForTest(t, s)
	schemaTestExec(t, pool, `INSERT INTO dndshare.item(id,user_id,hidden) VALUES(1635,NULL,false),(1636,NULL,false),(1637,1,false),(1638,NULL,true)`)
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
