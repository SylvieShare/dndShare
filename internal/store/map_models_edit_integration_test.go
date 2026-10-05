package store

import (
	"context"
	"errors"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"

	"dndshare/internal/battlemap"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMapModelRevisionPersistence(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_MAP_TEST_DSN")
	if dsn == "" {
		t.Skip("requires a disposable local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") {
		t.Fatal("requires an isolated local test database")
	}
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	ctx := context.Background()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE SCHEMA dndshare; CREATE TABLE dndshare.users(id bigint PRIMARY KEY); CREATE TABLE dndshare.session(id bigint PRIMARY KEY); CREATE TABLE dndshare.storage_image(id bigint PRIMARY KEY);`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	exec(schemaBattleMapsSQL)
	exec(schema3DMapsSQL)
	s := &Store{pool: pool}
	base := battlemap.InitialCatalogue()[0]
	base.Collection = "test"
	base.ID = "00000000-0000-4000-8000-000000000001"
	if _, err = s.RegisterMapModel(ctx, base); err != nil {
		t.Fatal(err)
	}
	edit := base
	edit.ID = "00000000-0000-4000-8000-000000000002"
	edit.Name = "Updated"
	edit.Width = 2
	saved, err := s.ReviseMapModel(ctx, base.ID, edit)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Version != 2 || saved.Width != 2 || !reflect.DeepEqual(saved.Assets, base.Assets) {
		t.Fatalf("unexpected revision: %+v", saved)
	}
	old, err := s.GetMapModel(ctx, base.ID)
	if err != nil || !reflect.DeepEqual(old, base) {
		t.Fatalf("original changed: %+v %v", old, err)
	}
	loaded, err := s.GetMapModel(ctx, saved.ID)
	if err != nil || !reflect.DeepEqual(loaded, saved) {
		t.Fatalf("revision readback: %+v %v", loaded, err)
	}
	if _, err = s.ReviseMapModel(ctx, base.ID, edit); !errors.Is(err, ErrMapModelConflict) {
		t.Fatalf("stale edit accepted: %v", err)
	}
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, id := range []string{"00000000-0000-4000-8000-000000000003", "00000000-0000-4000-8000-000000000004"} {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			m := saved
			m.ID = id
			m.Name = "Concurrent"
			_, err := s.ReviseMapModel(ctx, saved.ID, m)
			results <- err
		}(id)
	}
	wg.Wait()
	close(results)
	successes, conflicts := 0, 0
	for err := range results {
		if err == nil {
			successes++
		} else if errors.Is(err, ErrMapModelConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("concurrent edits: success=%d conflict=%d", successes, conflicts)
	}
}
