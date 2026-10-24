package store

import (
	"dndshare/internal/testdb"
	"encoding/json"
	"errors"
	"sync"
	"testing"

	"dndshare/internal/globalmap"
)

func TestGlobalMapsPostgres(t *testing.T) {
	pool := testdb.Pool(t)
	var err error
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
 CREATE TABLE dndshare.session_location(session_id bigint,id bigint);
 INSERT INTO dndshare.session VALUES(10),(20);
 INSERT INTO dndshare.storage_image(id,user_id,"type",url) VALUES(1,1,'image','/world.png'),(2,2,'image','/private.png');
 INSERT INTO dndshare.session_participant VALUES(10,41),(20,42);
 INSERT INTO dndshare.session_chapter VALUES(10,101),(10,102),(20,201);
 INSERT INTO dndshare.session_location VALUES(10,301),(10,302),(20,401);`)
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
	first.Routes = []globalmap.Route{{ID: "route", Name: "Путь", Color: "#d4ae69", PlayerIDs: []int64{41}, Points: []globalmap.Point{{ID: "point", X: .2, Y: .3, Note: "Привал", ChapterID: &chapter, AdditionalChapterIDs: []int64{102}, LocationIDs: []int64{301, 302}}, {ID: "bend", X: .4, Y: .6, Control: true}, {ID: "again", RefID: "point"}}}}
	saved, err := s.SaveGlobalMap(t.Context(), 10, first)
	if err != nil || saved.Revision != 2 || saved.Current {
		t.Fatal(saved, err)
	}
	if len(saved.Routes[0].Points[0].ChapterIDs()) != 2 || len(saved.Routes[0].Points[0].LocationIDs) != 2 || len(saved.Routes[0].Points) != 3 || !saved.Routes[0].Points[1].Control || saved.Routes[0].Points[2].RefID != "point" {
		t.Fatal("shared points and bends did not survive JSONB storage", saved)
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
	saved.Routes[0].Points[0].AdditionalChapterIDs = []int64{201}
	if _, err = s.SaveGlobalMap(t.Context(), 10, saved); !errors.Is(err, ErrInvalidWorldReference) {
		t.Fatal("foreign additional chapter accepted", err)
	}
	saved.Routes[0].Points[0].AdditionalChapterIDs = []int64{102}
	saved.Routes[0].Points[0].LocationIDs = []int64{401}
	if _, err = s.SaveGlobalMap(t.Context(), 10, saved); !errors.Is(err, ErrInvalidWorldReference) {
		t.Fatal("foreign location accepted", err)
	}
	saved.Routes[0].Points[0].LocationIDs = []int64{301, 302}
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
	exec(`DELETE FROM dndshare.session_chapter WHERE id=101; DELETE FROM dndshare.session_participant WHERE char_id=41; DELETE FROM dndshare.session_location WHERE id=301`)
	maps, err = s.ListGlobalMaps(t.Context(), 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(maps[0].Routes[0].PlayerIDs) != 0 || (maps[0].Routes[0].Points[0].ChapterID == nil || *maps[0].Routes[0].Points[0].ChapterID != 102) || maps[0].Routes[0].Points[0].Note != "Привал" || len(maps[0].Routes[0].Points[0].LocationIDs) != 1 || maps[0].Routes[0].Points[0].LocationIDs[0] != 302 {
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
