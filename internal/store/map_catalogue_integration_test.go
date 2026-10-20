package store

import (
	"context"
	"errors"
	"testing"
)

func testMapCatalogue(t *testing.T, ctx context.Context, s *Store, source BattleMap) {
	t.Helper()
	m, err := s.SaveBattleMap(ctx, 1, BattleMap{Name: "Каталог: пещера", Document: source.Document})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.GetReadableBattleMap(ctx, 2, m.ID); !errors.Is(err, ErrNotFound) {
		t.Fatal("private map leaked", err)
	}
	if _, err = s.PublishBattleMap(ctx, 2, m.ID, m.Revision); !errors.Is(err, ErrNotFound) {
		t.Fatal("foreign publication", err)
	}
	if _, err = s.PublishBattleMap(ctx, 1, m.ID, m.Revision+1); !errors.Is(err, ErrMapConflict) {
		t.Fatal("stale publication", err)
	}
	published, err := s.PublishBattleMap(ctx, 1, m.ID, m.Revision)
	if err != nil || published.PublishedAt == nil {
		t.Fatal("publish", err)
	}
	repeated, err := s.PublishBattleMap(ctx, 1, m.ID, m.Revision)
	if err != nil || repeated.Revision != published.Revision {
		t.Fatal("publish retry", err)
	}
	if _, err = s.SaveBattleMap(ctx, 1, published); !errors.Is(err, ErrMapPublished) {
		t.Fatal("published map edited", err)
	}
	if err = s.DeleteBattleMap(ctx, 1, m.ID); !errors.Is(err, ErrMapPublished) {
		t.Fatal("published map deleted", err)
	}
	read, err := s.GetReadableBattleMap(ctx, 2, m.ID)
	if err != nil || read.Owned || read.Subscribed {
		t.Fatal("read published", err)
	}
	if _, err = s.GetUsableBattleMap(ctx, 2, m.ID); !errors.Is(err, ErrMapSubscriptionRequired) {
		t.Fatal("subscription bypass", err)
	}
	if err = s.SubscribeMap(ctx, 1, m.ID, true); !errors.Is(err, ErrMapAction) {
		t.Fatal("self subscription", err)
	}
	for range 2 {
		if err = s.SubscribeMap(ctx, 2, m.ID, true); err != nil {
			t.Fatal(err)
		}
	}
	subscriptions, err := s.ListMapCatalogue(ctx, 2, "subscriptions")
	if err != nil || len(subscriptions) != 1 || subscriptions[0].ID != m.ID {
		t.Fatal("duplicate or missing subscription", err)
	}
	usable, err := s.GetUsableBattleMap(ctx, 2, m.ID)
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := s.AddSessionMap(ctx, 20, usable)
	if err != nil {
		t.Fatal(err)
	}
	if err = s.RateMap(ctx, 1, m.ID, 5); !errors.Is(err, ErrMapAction) {
		t.Fatal("self rating", err)
	}
	if err = s.RateMap(ctx, 2, m.ID, 6); !errors.Is(err, ErrMapAction) {
		t.Fatal("invalid rating", err)
	}
	for _, rating := range []int{5, 3} {
		if err = s.RateMap(ctx, 2, m.ID, rating); err != nil {
			t.Fatal(err)
		}
	}
	read, err = s.GetReadableBattleMap(ctx, 2, m.ID)
	if err != nil || read.Rating != 3 || read.RatingCount != 1 || read.MyRating != 3 {
		t.Fatal("rating replacement", read.Rating, read.RatingCount, err)
	}
	if _, err = s.pool.Exec(ctx, `INSERT INTO dndshare.users(id) VALUES(3)`); err != nil {
		t.Fatal(err)
	}
	if err = s.RateMap(ctx, 3, m.ID, 5); err != nil {
		t.Fatal(err)
	}
	read, err = s.GetReadableBattleMap(ctx, 2, m.ID)
	if err != nil || read.Rating != 4 || read.RatingCount != 2 || read.MyRating != 3 {
		t.Fatal("multi-user average", read.Rating, read.RatingCount, err)
	}
	if err = s.RateMap(ctx, 3, m.ID, 0); err != nil {
		t.Fatal(err)
	}
	if err = s.RateMap(ctx, 2, m.ID, 0); err != nil {
		t.Fatal(err)
	}
	read, err = s.GetReadableBattleMap(ctx, 2, m.ID)
	if err != nil || read.RatingCount != 0 || read.MyRating != 0 {
		t.Fatal("rating removal", err)
	}
	if err = s.SubscribeMap(ctx, 2, m.ID, false); err != nil {
		t.Fatal(err)
	}
	if _, err = s.GetUsableBattleMap(ctx, 2, m.ID); !errors.Is(err, ErrMapSubscriptionRequired) {
		t.Fatal("unsubscribe ignored", err)
	}
	if _, err = s.GetSessionMap(ctx, 20, snapshot.ID); err != nil {
		t.Fatal("unsubscribe removed session copy", err)
	}
	catalogue, err := s.ListMapCatalogue(ctx, 2, "catalogue")
	if err != nil || len(catalogue) != 1 {
		t.Fatal("catalogue", err)
	}
	summary := catalogue[0].Summary()
	if summary.Width != m.Document.Width || summary.TileCount != len(m.Document.Tiles) || summary.Author == "" {
		t.Fatal("compact summary", summary)
	}
}
