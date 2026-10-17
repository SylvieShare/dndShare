package store

import (
	"encoding/json"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"

	"dndshare/internal/globalmap"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestGlobalMapsPostgres(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_GLOBAL_MAP_TEST_DSN")
	if dsn == "" {
		t.Skip("requires disposable local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") {
		t.Fatal("requires isolated local database")
	}
	pool, err := pgxpool.NewWithConfig(t.Context(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(t.Context(), sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE SCHEMA dndshare;
 CREATE TABLE dndshare.session(id bigint PRIMARY KEY);
 CREATE TABLE dndshare.storage_image(id bigint PRIMARY KEY,user_id bigint,"type" text,deleted boolean DEFAULT false,url text);
 CREATE TABLE dndshare.session_participant(session_id bigint,char_id bigint);
 CREATE TABLE dndshare.session_chapter(session_id bigint,id bigint);
 INSERT INTO dndshare.session VALUES(10),(20);
 INSERT INTO dndshare.storage_image(id,user_id,"type",url) VALUES(1,1,'image','/world.png'),(2,2,'image','/private.png');
 INSERT INTO dndshare.session_participant VALUES(10,41),(20,42);
 INSERT INTO dndshare.session_chapter VALUES(10,101),(20,201);`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	exec(testSchemaTables(t, "session_global_map"))
	s := &Store{pool: pool}
	first, err := s.CreateGlobalMap(t.Context(), 10, 1, 1, "Мир")
	if err != nil || !first.Current {
		t.Fatal(first, err)
	}
	second, err := s.CreateGlobalMap(t.Context(), 10, 1, 1, "Регион")
	if err != nil || !second.Current {
		t.Fatal(second, err)
	}
	maps, err := s.ListGlobalMaps(t.Context(), 10)
	if err != nil || len(maps) != 2 || maps[0].Current || !maps[1].Current {
		t.Fatal(maps, err)
	}
	if _, err = s.CreateGlobalMap(t.Context(), 10, 1, 2, "Чужое"); !errors.Is(err, ErrInvalidWorldReference) {
		t.Fatal("foreign image accepted", err)
	}
	chapter := int64(101)
	first.Routes = []globalmap.Route{{ID: "route", Name: "Путь", Color: "#d4ae69", PlayerIDs: []int64{41}, Points: []globalmap.Point{{ID: "point", X: .2, Y: .3, Note: "Привал", ChapterID: &chapter}}}}
	saved, err := s.SaveGlobalMap(t.Context(), 10, first)
	if err != nil || saved.Revision != 2 || saved.Current {
		t.Fatal(saved, err)
	}
	if _, err = s.SaveGlobalMap(t.Context(), 10, first); !errors.Is(err, ErrMapConflict) {
		t.Fatal("stale version accepted", err)
	}
	if err = s.ActivateGlobalMap(t.Context(), 20, first.ID); !errors.Is(err, ErrNotFound) {
		t.Fatal("cross-session activation accepted", err)
	}
	saved.Routes[0].PlayerIDs = []int64{42}
	if _, err = s.SaveGlobalMap(t.Context(), 10, saved); !errors.Is(err, ErrInvalidWorldReference) {
		t.Fatal("foreign player accepted", err)
	}
	saved.Routes[0].PlayerIDs = []int64{41}
	foreign := int64(201)
	saved.Routes[0].Points[0].ChapterID = &foreign
	if _, err = s.SaveGlobalMap(t.Context(), 10, saved); !errors.Is(err, ErrInvalidWorldReference) {
		t.Fatal("foreign chapter accepted", err)
	}
	saved.Routes[0].Points[0].ChapterID = &chapter
	var wg sync.WaitGroup
	results := make(chan error, 2)
	raw, err := json.Marshal(saved)
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		var candidate GlobalMap
		if err := json.Unmarshal(raw, &candidate); err != nil {
			t.Fatal(err)
		}
		wg.Add(1)
		go func(candidate GlobalMap) {
			defer wg.Done()
			_, err := s.SaveGlobalMap(t.Context(), 10, candidate)
			results <- err
		}(candidate)
	}
	wg.Wait()
	close(results)
	success, conflicts := 0, 0
	for err := range results {
		if err == nil {
			success++
		} else if errors.Is(err, ErrMapConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if success != 1 || conflicts != 1 {
		t.Fatal("CAS failed", success, conflicts)
	}
	if _, err = pool.Exec(t.Context(), `DELETE FROM dndshare.storage_image WHERE id=1`); err == nil {
		t.Fatal("referenced image deletion accepted")
	}
	exec(`DELETE FROM dndshare.session_chapter WHERE id=101; DELETE FROM dndshare.session_participant WHERE char_id=41`)
	maps, err = s.ListGlobalMaps(t.Context(), 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(maps[0].Routes[0].PlayerIDs) != 0 || maps[0].Routes[0].Points[0].ChapterID != nil || maps[0].Routes[0].Points[0].Note != "Привал" {
		t.Fatal("detached links projection", maps[0])
	}
	if err = s.ActivateGlobalMap(t.Context(), 10, first.ID); err != nil {
		t.Fatal(err)
	}
	if err = s.DeleteGlobalMap(t.Context(), 10, first.ID); err != nil {
		t.Fatal(err)
	}
	maps, err = s.ListGlobalMaps(t.Context(), 10)
	if err != nil || len(maps) != 1 || maps[0].ID != second.ID || !maps[0].Current {
		t.Fatal(maps, err)
	}
	exec(`DELETE FROM dndshare.session WHERE id=10`)
	maps, err = s.ListGlobalMaps(t.Context(), 10)
	if err != nil || len(maps) != 0 {
		t.Fatal("session cascade", maps, err)
	}
}
