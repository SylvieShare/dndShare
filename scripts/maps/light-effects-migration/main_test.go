package main

import (
	"context"
	"dndshare/internal/battlemap"
	"dndshare/internal/testdb"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

func TestOfflineMigrationPostgres(t *testing.T) {
	dsn := testdb.DSN(t)
	u, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("APP_ENV", "test")
	t.Setenv("DB_URL", dsn)
	t.Setenv("DB_USER", u.User.Username())
	t.Setenv("DB_PASSWORD", "")
	ctx := context.Background()
	db, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close(ctx)
	_, err = db.Exec(ctx, `DROP SCHEMA IF EXISTS dndshare CASCADE; CREATE SCHEMA dndshare;
 CREATE TABLE dndshare.map_model_definition(id text PRIMARY KEY,revision int,default_lights jsonb,default_flags jsonb,default_effects jsonb);
 CREATE TABLE dndshare.battle_map(id uuid PRIMARY KEY,revision int,document jsonb,changed_at timestamptz);
 CREATE TABLE dndshare.session_map(id uuid PRIMARY KEY,revision int,document jsonb,changed_at timestamptz,state jsonb);`)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, `DROP SCHEMA dndshare CASCADE`)
	_, err = db.Exec(ctx, `INSERT INTO dndshare.map_model_definition VALUES('torch',1,'[{"key":"lamp","name":"Свет","kind":"torch","color":"#68cfff","position":[0.5,0.5,1],"intensity":8,"radius":4,"enabled":true,"flagKey":"burning"}]','[{"key":"burning","enabled":true}]','[{"key":"fire","kind":"fire","size":[0.2,0.4],"strength":0.7,"position":[0.5,0.5,0.8],"enabled":true,"flagKey":"burning"}]')`)
	if err != nil {
		t.Fatal(err)
	}
	raw := json.RawMessage(`{"version":2,"kind":"tiles","width":10,"height":10,"tiles":[],"objects":[],"flags":[{"id":"burning","enabled":false}],"lights":[{"id":"light","name":"Свет","kind":"torch","color":"#68cfff","x":2,"y":3,"elevation":0,"height":1,"intensity":8,"radius":4,"enabled":true,"flagId":"burning"}],"effects":[{"id":"fire","name":"Огонь","kind":"fire","color":"#ffb04a","size":[0.4,0.6],"strength":0.8,"enabled":true,"flagId":"burning","x":2.1,"y":3,"height":0.7}]}`)
	for _, table := range []string{"battle_map", "session_map"} {
		_, err = db.Exec(ctx, `INSERT INTO dndshare.`+table+`(id,revision,document) VALUES('00000000-0000-4000-8000-000000000001',1,$1)`, raw)
		if err != nil {
			t.Fatal(err)
		}
	}
	_, err = db.Exec(ctx, `UPDATE dndshare.session_map SET state='{"fog":false,"turn":12}'`)
	if err != nil {
		t.Fatal(err)
	}
	ddl, err := os.ReadFile("../../../internal/store/schema/004_light_owned_effects.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, string(ddl)); err == nil {
		t.Fatal("structural migration discarded unconverted templates")
	}
	path := filepath.Join(t.TempDir(), "before.json")
	if err = run(false, path); err != nil {
		t.Fatal(err)
	}
	var revision int
	db.QueryRow(ctx, `SELECT revision FROM dndshare.battle_map`).Scan(&revision)
	if revision != 1 {
		t.Fatal("preview wrote")
	}
	if err = run(true, path); err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(path); err != nil {
		t.Fatal("backup missing", err)
	}
	var data []byte
	var state string
	db.QueryRow(ctx, `SELECT document,state->>'turn' FROM dndshare.session_map`).Scan(&data, &state)
	var d battlemap.Document
	json.Unmarshal(data, &d)
	if state != "12" || d.Lights[0].Enabled || d.Lights[0].Effect.Kind != "fire" {
		t.Fatal("state lost", string(data), state)
	}
	if err = run(false, path); err != nil {
		t.Fatal("repeat preview", err)
	}
	if _, err = db.Exec(ctx, string(ddl)); err != nil {
		t.Fatal("structural migration after conversion", err)
	}
}
