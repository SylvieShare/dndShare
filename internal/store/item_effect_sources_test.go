package store

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"testing"
)

func TestEffectSourcesPersistenceAndVisibility(t *testing.T) {
	pool := currentSchemaTestPool(t)
	seedTestUsers(t, pool, 7, 8)
	seedTestItemTypes(t, pool, 2, 4, 5, 15, 19)
	ctx := context.Background()
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO dndshare.item(id,name,type_id,data) VALUES
 (86,'Посох иссушения',19,'{"status_effects":[{"effect":{"id":9000},"target":"other"}]}'),
 (9000,'Иссушение',15,'{"application_sources":[{"item":86,"target":"other"}]}');`)
	effectID := int64(9000)
	s := &Store{pool: pool}
	search := func(user *int64, id int64, limit, offset int) []ItemEffectSource {
		t.Helper()
		rows, err := s.FindItemEffectSources(ctx, user, id, limit, offset)
		if err != nil {
			t.Fatal(err)
		}
		return rows
	}
	if rows := search(nil, effectID, 40, 0); len(rows) != 1 || rows[0].ItemID != 86 || rows[0].Target != "other" {
		t.Fatalf("staff source: %+v", rows)
	}
	payload := `{"status_effects":[{"effect":{"id":` + strconv.FormatInt(effectID, 10) + `},"condition":"condition"}]}`
	exec(`INSERT INTO dndshare.item(id,user_id,custom_source_id,name,type_id,data) VALUES(1,7,(SELECT id FROM dndshare.custom_item_source WHERE user_id=7 AND is_default),'A own',4,$1::jsonb),(2,8,(SELECT id FROM dndshare.custom_item_source WHERE user_id=8 AND is_default),'B private',5,$1::jsonb),(3,NULL,NULL,'C public',2,$1::jsonb)`, payload)
	exec(`INSERT INTO dndshare.item(id,name,type_id,data) VALUES(4,'bad array',2,'{"status_effects":{}}'),(5,'bad elements',2,'{"status_effects":[null,17,"str",{"effect":"not-an-id"}]}')`)
	exec(`UPDATE dndshare.item SET data=jsonb_set(data,'{application_sources}',(data->'application_sources')||'[ {"item":1,"condition":"condition"},{"item":2},{"item":3} ]'::jsonb) WHERE id=$1`, effectID)
	user := int64(7)
	if len(search(nil, effectID, 40, 0)) != 2 || len(search(&user, effectID, 40, 0)) != 3 {
		t.Fatal("source visibility mismatch")
	}
	projected, err := s.attachEffectPresentation(ctx, []Item{{TypeID: 15, Data: json.RawMessage(`{"application_sources":[{"item":1,"condition":"own"},{"item":2,"condition":"private"},{"item":3}]}`)}}, &user)
	if err != nil || strings.Contains(string(projected[0].Data), "private") || !strings.Contains(string(projected[0].Data), "own") {
		t.Fatalf("private source projection: %v %v", projected, err)
	}
	first, second := search(&user, effectID, 1, 0), search(&user, effectID, 1, 1)
	if len(first) != 1 || len(second) != 1 || first[0].ItemID == second[0].ItemID {
		t.Fatal("pagination does not advance")
	}
	exec(`UPDATE dndshare.item SET user_id=8,custom_source_id=(SELECT id FROM dndshare.custom_item_source WHERE user_id=8 AND is_default) WHERE id=$1`, effectID)
	if len(search(&user, effectID, 40, 0)) != 0 {
		t.Fatal("private effect leaked")
	}
	exec(`UPDATE dndshare.item SET user_id=NULL,custom_source_id=NULL WHERE id=$1`, effectID)
	exec(`UPDATE dndshare.item SET data='{}' WHERE id=3; DELETE FROM dndshare.item WHERE id=1;`)
	if len(search(&user, effectID, 40, 0)) != 2 {
		t.Fatal("explicit sources persist after mechanics edit; deleted items are hidden")
	}
}
