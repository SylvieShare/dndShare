package store

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
)

// Run on the historical schema before 189, including actual placed revisions.
func testCurrentModelMigration(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO dndshare.users VALUES(901);INSERT INTO dndshare.session VALUES(902);
 INSERT INTO dndshare.map_model(id,collection,source_code,source_name,name,version,tile_type,geometry,assets)
 SELECT '90000000-0000-4000-8000-000000000001',collection,source_code,source_name,'Latest sculpt',99,tile_type,geometry||'{"maxHeight":2}'::jsonb,assets
 FROM dndshare.map_model ORDER BY id LIMIT 1;
 INSERT INTO dndshare.battle_map(id,owner_user_id,name,document) VALUES('90000000-0000-4000-8000-000000000002',901,'revision migration',
 '{"tiles":[{"id":"placed","modelId":"90000000-0000-4000-8000-000000000001","x":3,"y":4,"rotation":90,"level":2}],"objects":[],"areas":[{"id":"room","tileIds":["placed"]}],"lights":[{"id":"light","anchor":{"kind":"tile","id":"placed"}}]}');
 INSERT INTO dndshare.battle_map_model VALUES('90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000001');
 INSERT INTO dndshare.session_map(id,session_id,name,document,state)
 SELECT '90000000-0000-4000-8000-000000000003',902,name,document,'{"tokens":[{"id":"hero","x":3,"y":4}]}' FROM dndshare.battle_map WHERE name='revision migration';
 INSERT INTO dndshare.session_map_model VALUES('90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000001');`)
	var canonical, oldDocument, state string
	if err := pool.QueryRow(ctx, `SELECT m.id::text,b.document::text,s.state::text FROM dndshare.map_model m CROSS JOIN dndshare.battle_map b CROSS JOIN dndshare.session_map s WHERE m.definition_id=(SELECT definition_id FROM dndshare.map_model WHERE id='90000000-0000-4000-8000-000000000001') AND b.name='revision migration' AND s.name=b.name ORDER BY m.version LIMIT 1`).Scan(&canonical, &oldDocument, &state); err != nil {
		t.Fatal(err)
	}
	exec(schemaCurrentMapModelsSQL)
	var count int
	var correct bool
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.map_model WHERE id='90000000-0000-4000-8000-000000000001'`).Scan(&count); err != nil || count != 0 {
		t.Fatal("old version survived", err)
	}
	if err := pool.QueryRow(ctx, `SELECT b.document=replace($2,'90000000-0000-4000-8000-000000000001',$1)::jsonb AND s.document=b.document AND s.state=$3::jsonb AND m.name='Latest sculpt' AND (m.geometry->>'maxHeight')::numeric=2 AND bm.model_id=m.id AND sm.model_id=m.id FROM dndshare.battle_map b JOIN dndshare.session_map s ON s.name=b.name JOIN dndshare.map_model m ON m.id=$1::uuid JOIN dndshare.battle_map_model bm ON bm.map_id=b.id JOIN dndshare.session_map_model sm ON sm.map_id=s.id WHERE b.name='revision migration'`, canonical, oldDocument, state).Scan(&correct); err != nil || !correct {
		t.Fatal("migration damaged placement, anchors, state or current geometry", err)
	}
	exec(`DELETE FROM dndshare.battle_map WHERE name='revision migration'; DELETE FROM dndshare.session_map WHERE name='revision migration';DELETE FROM dndshare.users WHERE id=901;DELETE FROM dndshare.session WHERE id=902`)
	// Restore seed name/height so the other historical data-correction assertions are independent.
	exec(`UPDATE dndshare.map_model SET name=source_name,geometry=jsonb_set(geometry,'{maxHeight}','1.5') WHERE id='` + canonical + `'`)
}
