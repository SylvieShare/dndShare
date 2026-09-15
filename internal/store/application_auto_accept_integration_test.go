package store

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
)

func testAutoAccept(t *testing.T, s *Store, pool *pgxpool.Pool) {
	ctx := context.Background()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	seq := 100
	next := func() string { seq++; return fmt.Sprintf("10000000-0000-4000-8000-%012d", seq) }
	version := func() int64 {
		var v int64
		_ = pool.QueryRow(ctx, `SELECT version FROM dndshare."char" WHERE id=10`).Scan(&v)
		return v
	}
	exec(`UPDATE dndshare."session" SET settings=settings||'{"autoAccept":{"items":false,"potions":true,"spells":false}}'::jsonb WHERE id=1`)
	defer exec(`UPDATE dndshare."session" SET settings=settings||'{"autoAccept":{"items":false,"potions":false,"spells":false}}'::jsonb WHERE id=1`)
	a := next()
	v := version()
	potion, err := s.CreatePotionUse(ctx, 1, 1, 10, 11, v, "dose", a)
	if err != nil || potion.Status != "accepted" {
		t.Fatalf("automatic potion: %+v %v", potion, err)
	}
	retry, err := s.CreatePotionUse(ctx, 1, 1, 10, 11, v, "dose", a)
	if err != nil || retry.ID != potion.ID || string(retry.ApplicationResult) != string(potion.ApplicationResult) {
		t.Fatalf("automatic retry: %+v %v", retry, err)
	}
	spell, err := s.CreateSpellApplication(ctx, 1, 1, 10, 11, version(), "802", next(), "test")
	if err != nil || spell.Status != "pending" {
		t.Fatalf("independent spell setting: %+v %v", spell, err)
	}
	if _, err = s.ResolveItemTransfer(ctx, 2, 11, spell.ID, false); err != nil {
		t.Fatal(err)
	}
	dm, err := s.CreatePotionUse(ctx, 1, 1, 10, 0, version(), "dose", next())
	if err != nil || dm.Status != "pending" {
		t.Fatalf("DM must select target: %+v %v", dm, err)
	}
	if _, err = s.ResolveSessionApplication(ctx, 3, 1, dm.EventID, false, ApplicationTarget{}); err != nil {
		t.Fatal(err)
	}
	exec(`UPDATE dndshare."session" SET settings=jsonb_set(settings,'{autoAccept,spells}','true') WHERE id=1`)
	spell, err = s.CreateSpellApplication(ctx, 1, 1, 10, 11, version(), "802", next(), "test")
	if err != nil || spell.Status != "accepted" {
		t.Fatalf("automatic spell: %+v %v", spell, err)
	}
	exec(`UPDATE dndshare."char" SET data=jsonb_set(data,'{values,items}','{"equipped":[{"uid":"gift","item_id":800,"count":2}]}') WHERE id=10`)
	gift, err := s.CreateItemTransfer(ctx, 1, 1, 10, 11, version(), "items", "gift", next())
	if err != nil || gift.Status != "pending" {
		t.Fatalf("independent item setting: %+v %v", gift, err)
	}
	if _, err = s.ResolveItemTransfer(ctx, 2, 11, gift.ID, false); err != nil {
		t.Fatal(err)
	}
	exec(`UPDATE dndshare."session" SET settings=jsonb_set(settings,'{autoAccept,items}','true') WHERE id=1`)
	gift, err = s.CreateItemTransfer(ctx, 1, 1, 10, 11, version(), "items", "gift", next())
	if err != nil || gift.Status != "accepted" {
		t.Fatalf("automatic item: %+v %v", gift, err)
	}
	var count int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.session_event WHERE id IN ($1,$2,$3) AND data->>'autoAccepted'='true'`, potion.EventID, spell.EventID, gift.EventID).Scan(&count)
	if count != 3 {
		t.Fatalf("automatic events: %d", count)
	}
	exec(`UPDATE dndshare."session" SET settings=jsonb_set(settings,'{interactions}','{"items":false,"potions":false,"spells":false}') WHERE id=1`)
	defer exec(`UPDATE dndshare."session" SET settings=jsonb_set(settings,'{interactions}','{"items":true,"potions":true,"spells":true}') WHERE id=1`)
	if _, err = s.CreatePotionUse(ctx, 1, 1, 10, 11, version(), "dose", next()); err == nil {
		t.Fatal("disabled potion allowed")
	}
	if _, err = s.CreateSpellApplication(ctx, 1, 1, 10, 11, version(), "802", next(), "test"); err == nil {
		t.Fatal("disabled spell allowed")
	}
	if _, err = s.CreateItemTransfer(ctx, 1, 1, 10, 11, version(), "items", "gift", next()); err == nil {
		t.Fatal("disabled transfer allowed")
	}
	var returnedUID string
	if err = pool.QueryRow(ctx, `SELECT data#>>'{values,potions,0,uid}' FROM dndshare."char" WHERE id=10`).Scan(&returnedUID); err != nil {
		t.Fatal(err)
	}
	if _, err = s.UsePotionSelf(ctx, 1, 10, version(), returnedUID, next(), ""); err != nil {
		t.Fatalf("self-use remains allowed: %v", err)
	}

}
