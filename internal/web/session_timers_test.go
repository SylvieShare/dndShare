package web

import (
	"testing"
	"time"

	"dndshare/internal/store"
)

func TestProjectSessionTimerUsesAbsoluteDeadline(t *testing.T) {
	now := time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC)
	endsAt := now.Add(90 * time.Second)
	timer := store.SessionTimer{
		ID: 7, Description: "Стража прибудет", DurationMS: 120_000,
		EndsAt: &endsAt, Broadcast: true, CreatedAt: now.Add(-30 * time.Second), ChangedAt: now,
	}
	projected := projectSessionTimer(timer, now)
	if projected.RemainingMS != 90_000 || projected.Completed || projected.EndsAt == nil || !projected.Broadcast {
		t.Fatalf("unexpected running timer projection: %#v", projected)
	}
}

func TestProjectSessionTimerKeepsPausedAndCompletedStates(t *testing.T) {
	now := time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC)
	remaining := int64(42_000)
	paused := projectSessionTimer(store.SessionTimer{
		ID: 1, Description: "Пауза", DurationMS: 60_000, RemainingMS: &remaining,
		Paused: true, CreatedAt: now, ChangedAt: now,
	}, now)
	if paused.RemainingMS != remaining || paused.Completed || paused.EndsAt != nil {
		t.Fatalf("unexpected paused timer projection: %#v", paused)
	}

	past := now.Add(-time.Second)
	completed := projectSessionTimer(store.SessionTimer{
		ID: 2, Description: "Готово", DurationMS: 60_000, EndsAt: &past,
		CreatedAt: now, ChangedAt: now,
	}, now)
	if completed.RemainingMS != 0 || !completed.Completed {
		t.Fatalf("unexpected completed timer projection: %#v", completed)
	}
}
