package store

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func testMapPreviewPersistence(t *testing.T, ctx context.Context, s *Store, m BattleMap) {
	t.Helper()
	p := MapPreview{Signature: strings.Repeat("a", 64), ObjectKey: "map-previews/first.webp", FileSize: 500}
	if _, err := s.SaveMapPreview(ctx, 2, m, p); !errors.Is(err, ErrNotFound) {
		t.Fatal("preview owner isolation", err)
	}
	if old, err := s.SaveMapPreview(ctx, 1, m, p); err != nil || old != "" {
		t.Fatal("first preview", old, err)
	}
	loaded, err := s.GetMapPreview(ctx, m.ID, false)
	if err != nil || loaded != p {
		t.Fatal("preview readback", loaded, err)
	}
	stale := m
	stale.Revision++
	if _, err = s.SaveMapPreview(ctx, 1, stale, p); !errors.Is(err, ErrMapConflict) {
		t.Fatal("stale screenshot accepted", err)
	}
	p.ObjectKey = "map-previews/second.webp"
	p.Signature = strings.Repeat("b", 64)
	if old, err := s.SaveMapPreview(ctx, 1, m, p); err != nil || old != "map-previews/first.webp" {
		t.Fatal("replacement cleanup key", old, err)
	}
	current, err := s.GetBattleMap(ctx, 1, m.ID)
	if err != nil || current.Revision != m.Revision {
		t.Fatal("preview advanced document revision", err)
	}
	system := BattleMap{ID: "cave-small", System: true}
	p.ObjectKey = "map-previews/system.webp"
	if _, err = s.SaveMapPreview(ctx, 1, system, p); err != nil {
		t.Fatal(err)
	}
	if got, err := s.GetMapPreview(ctx, system.ID, true); err != nil || got != p {
		t.Fatal("system preview", got, err)
	}
}
