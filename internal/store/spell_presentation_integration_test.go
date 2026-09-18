package store

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func testSpellPresentation(t *testing.T, pool *pgxpool.Pool) {
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `UPDATE dndshare.item_type SET fields='[{"key":"time","type":"text"},{"key":"range","type":"text"}]' WHERE id=5;
 INSERT INTO dndshare.item_type(id,fields) VALUES(999,'[{"key":"feature_actions","fields":[{"key":"action_type","options":[{"value":"action","label":"Действие"}]}]}]');
 INSERT INTO dndshare.item(id,type_id,name,data) VALUES(99901,5,'Проверка','{"time":"1 реакция, когда попадает атака ","range":"На себя (15-футовый конус)","description":"Условия сохранены"}');`)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = tx.Exec(ctx, schemaSpellPresentationSQL); err != nil {
		t.Fatal(err)
	}
	var raw []byte
	if err = tx.QueryRow(ctx, `SELECT data FROM dndshare.item WHERE id=99901`).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	var data map[string]any
	if err = json.Unmarshal(raw, &data); err != nil {
		t.Fatal(err)
	}
	if object(data["time"])["kind"] != "reaction" || object(data["time"])["condition"] != "когда попадает атака" || object(data["range"])["shape"] != "cone" || number(object(data["range"])["size"]) != 15 || data["description"] != "Условия сохранены" {
		t.Fatalf("migrated item %s", raw)
	}
	cases := []struct{ input, function, expected string }{
		{"1 действие", "spell_time", `{"kind":"action"}`},
		{"1 бонусное действие", "spell_time", `{"kind":"bonus_action"}`},
		{"10 минут", "spell_time", `{"kind":"minutes","value":10}`},
		{"24 часа", "spell_time", `{"kind":"hours","value":24}`},
		{"8 часов или 1 действие", "spell_time", `{"kind":"custom","text":"8 часов или 1 действие"}`},
		{"Касание", "spell_range", `{"kind":"touch"}`},
		{"На себя", "spell_range", `{"kind":"self","can_self":true}`},
		{"60 футов", "spell_range", `{"kind":"ranged","distance":60,"unit":"feet"}`},
		{"100 миль", "spell_range", `{"kind":"ranged","distance":100,"unit":"miles"}`},
		{"На себя (радиусом 5 футов)", "spell_range", `{"kind":"self","shape":"radius","size":5,"area_unit":"feet"}`},
		{"На себя  (сфера радиусом 30 фт)", "spell_range", `{"kind":"self","shape":"sphere","size":30,"area_unit":"feet"}`},
		{"На себя (5-мильный радиус)", "spell_range", `{"kind":"self","shape":"radius","size":5,"area_unit":"miles"}`},
		{"На себя (15-футовый конус или 30-футовая линия)", "spell_range", `{"kind":"custom","text":"На себя (15-футовый конус или 30-футовая линия)"}`},
	}
	for _, test := range cases {
		var equal bool
		// Function names are test constants, values stay parameterized.
		if err = tx.QueryRow(ctx, "SELECT pg_temp."+test.function+"($1) = $2::jsonb", test.input, test.expected).Scan(&equal); err != nil || !equal {
			t.Fatalf("%s: %v, match %v", test.input, err, equal)
		}
	}
	var valid bool
	if err = tx.QueryRow(ctx, `SELECT fields#>>'{0,type}'='object' AND fields#>>'{1,type}'='object' FROM dndshare.item_type WHERE id=5`).Scan(&valid); err != nil || !valid {
		t.Fatalf("spell schema %v %v", valid, err)
	}
	if err = tx.QueryRow(ctx, `SELECT fields#>>'{0,fields,0,options,1,value}'='timed' AND fields#>>'{0,fields,1,key}'='time' FROM dndshare.item_type WHERE id=999`).Scan(&valid); err != nil || !valid {
		t.Fatalf("action schema %v %v", valid, err)
	}
}
