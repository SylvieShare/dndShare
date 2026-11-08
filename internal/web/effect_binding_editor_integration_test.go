package web

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"strconv"
	"testing"
)

func TestAuthoredEffectBindingsPostgres(t *testing.T) {
	raw, err := os.ReadFile("../../native/fixtures/game-mechanics/effect-bindings.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures []struct {
		Name      string         `json:"name"`
		BaseLevel int            `json:"baseLevel"`
		Binding   map[string]any `json:"binding"`
		Effect    struct {
			Data map[string]any `json:"data"`
		} `json:"effect"`
		Casts []struct{ Level, Score, Want int } `json:"casts"`
	}
	if err := json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatal(err)
	}
	f := newAuthHTTPFixture(t)
	client := authClient(t)
	user, _ := f.request(client, "POST", "/api/user/registration", `{"login":"author","password":"test-author-password"}`, 200)
	owner := int64(user["id"].(float64))
	for _, id := range []int{5, 15} {
		fields, err := os.ReadFile(fmt.Sprintf("../../resources/items/item_%d_shema.json", id))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := f.pool.Exec(t.Context(), `INSERT INTO dndshare.item_type(id,name,source_id,fields) VALUES($1,'Тест',1,$2::jsonb)`, id, string(fields)); err != nil {
			t.Fatal(err)
		}
	}
	const char = "63000000-0000-4000-8000-000000000001"
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO dndshare.char_template(id,name) OVERRIDING SYSTEM VALUE VALUES(1,'DND5')`); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO dndshare."char"(id,uuid,user_id,template_id,source_version_id,data) VALUES(1,$1,$2,1,1,'{"values":{"name":"Маг"}}')`, char, owner); err != nil {
		t.Fatal(err)
	}
	encode := func(value any) string {
		t.Helper()
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		return string(raw)
	}
	create := func(t *testing.T, kind int, name string, data map[string]any) int64 {
		t.Helper()
		local := f
		local.t = t
		item, _ := local.request(client, "POST", "/api/items", encode(map[string]any{
			"typeId": kind, "name": name, "data": data,
			"compatibility": []any{map[string]any{"sourceVersionId": 1, "status": "native"}},
		}), 200)
		return int64(item["id"].(float64))
	}
	for index, fixture := range fixtures {
		t.Run(fixture.Name, func(t *testing.T) {
			f := f
			f.t = t
			effectID := create(t, 15, "Эффект "+fixture.Name, fixture.Effect.Data)
			link := map[string]any{"key": "enchant", "effect": map[string]any{"id": effectID},
				"target": "self", "parameter_bindings": []any{fixture.Binding}}
			data := map[string]any{"lvl": fixture.BaseLevel, "status_effects": []any{link}}
			spellID := create(t, 5, fixture.Name, data)
			read, _ := f.request(client, "GET", "/api/items/by-ids?ids="+strconv.FormatInt(spellID, 10), "", 200)
			stored := read["items"].([]any)[0].(map[string]any)["data"].(map[string]any)
			bindings := stored["status_effects"].([]any)[0].(map[string]any)["parameter_bindings"].([]any)
			if len(bindings) != 1 || !reflect.DeepEqual(bindings[0], fixture.Binding) {
				t.Fatalf("saved rule changed: %v", bindings)
			}
			f.request(client, "PUT", "/api/items/"+strconv.FormatInt(spellID, 10), encode(map[string]any{
				"name": fixture.Name, "data": stored,
				"compatibility": []any{map[string]any{"sourceVersionId": 1, "status": "native"}},
			}), 204)
			for row, cast := range fixture.Casts {
				score := cast.Score
				if score == 0 {
					score = 18
				}
				sheet := map[string]any{"values": map[string]any{
					"name": "Маг", "lvl": map[string]any{"level": 17}, "INT": map[string]any{"value": map[string]any{"base": score}},
					"spells": map[string]any{"tabs": []any{map[string]any{"key": "wizard", "casting_ability": 4,
						"spells": []any{map[string]any{"id": spellID, "key": "known"}}}},
						"slot_pools": map[string]any{"long_rest": []any{map[string]any{"level": cast.Level, "total": 2, "used": 0}}}},
				}}
				var version int64
				if err := f.pool.QueryRow(t.Context(), `UPDATE dndshare."char" SET data=$1::jsonb WHERE id=1 RETURNING version`, encode(sheet)).Scan(&version); err != nil {
					t.Fatal(err)
				}
				f.request(client, "POST", "/api/char/"+char+"/spell-cast", encode(map[string]any{
					"spellId": spellID, "entryKey": "known", "optionKey": "enchant", "version": version,
					"clientActionId": fmt.Sprintf("63000000-0000-4000-8000-%012d", index*100+row+1),
					"castLevel":      cast.Level, "spendSlot": true, "pool": "long_rest", "targets": []string{"self"},
				}), 200)
				applied, _ := f.request(client, "GET", "/api/char/"+char, "", 200)
				values := applied["data"].(map[string]any)["values"].(map[string]any)
				states := values["states"].([]any)
				if len(states) != 1 {
					t.Fatalf("expected one applied effect, got %v", states)
				}
				params := states[0].(map[string]any)["params"].(map[string]any)
				if params[fixture.Binding["key"].(string)] != float64(cast.Want) {
					t.Fatalf("cast at level %d: params=%v, want=%d", cast.Level, params, cast.Want)
				}
				pool := values["spells"].(map[string]any)["slot_pools"].(map[string]any)["long_rest"].([]any)
				if pool[0].(map[string]any)["used"] != float64(1) {
					t.Fatal("cast did not spend exactly one slot", pool)
				}
			}
		})
	}
}
