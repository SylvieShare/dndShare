package store

import (
	"context"
	"fmt"
	"reflect"
	"sync"
	"testing"
)

func testSessionKarmicDicePostgres(t *testing.T, s *Store, sessionID int64) {
	ctx := context.Background()
	var hero, other string
	if err := s.pool.QueryRow(ctx, `SELECT uuid::text FROM dndshare.char WHERE id=1`).Scan(&hero); err != nil {
		t.Fatal(err)
	}
	if err := s.pool.QueryRow(ctx, `SELECT uuid::text FROM dndshare.char WHERE id=2`).Scan(&other); err != nil {
		t.Fatal(err)
	}
	seq := 0
	request := func(actor string) SessionD20Request {
		seq++
		return SessionD20Request{RequestID: fmt.Sprintf("00000000-0000-4000-8000-%012d", seq), Kind: "ability_check", Mode: "normal", CharUUID: actor}
	}
	req := request(hero)
	plain, err := s.RollSessionD20(ctx, sessionID, 10, req)
	if err != nil || plain.Karmic || len(plain.Rolls) != 1 {
		t.Fatalf("disabled: %+v %v", plain, err)
	}
	if _, err = s.RollSessionD20(ctx, sessionID, 20, request(hero)); err == nil {
		t.Fatal("player rolled another player's character")
	}
	if err = s.UpdateSessionSetting(ctx, sessionID, "karmicDice.enabled", true); err != nil {
		t.Fatal(err)
	}
	if err = s.UpdateSessionSetting(ctx, sessionID, "karmicDice.separate", true); err != nil {
		t.Fatal(err)
	}
	if _, err = s.pool.Exec(ctx, `INSERT INTO dndshare.session_karmic_scale VALUES($1,$2,'Hero',6),($1,$3,'Other',-6)`, sessionID, "char:"+hero, "char:"+other); err != nil {
		t.Fatal(err)
	}
	low, err := s.RollSessionD20(ctx, sessionID, 10, request(hero))
	if err != nil || !low.Karmic || low.BalanceBefore != 6 || low.BalanceAfter != karmicNextBalance(6, low.Rolls[0], "normal") || low.Rolls[0] < 1 || low.Rolls[0] > 20 {
		t.Fatalf("hero scale: %+v %v", low, err)
	}
	high, err := s.RollSessionD20(ctx, sessionID, 20, request(other))
	if err != nil || high.BalanceBefore != -6 || high.Rolls[0] < 1 || high.Rolls[0] > 20 {
		t.Fatalf("separate scale: %+v %v", high, err)
	}
	if _, err = s.pool.Exec(ctx, `CREATE TABLE dndshare.session_encounter (id bigserial PRIMARY KEY, session_id bigint, data jsonb, deleted bool DEFAULT false);
 CREATE TABLE dndshare.item (id bigint, name text);
 INSERT INTO dndshare.item VALUES(30,'Гоблин');
 INSERT INTO dndshare.session_encounter(session_id,data) VALUES($1,'{"combatants":[{"uid":"goblin-one","type":"npc","override":{"name":"Гоблин"},"markerLetter":"A"},{"uid":"goblin-two","type":"npc","itemId":30,"markerLetter":"B"}]}')`, sessionID); err != nil {
		t.Fatal(err)
	}
	npcReq := request("")
	npcReq.NPCUID = "goblin-one"
	npc, err := s.RollSessionD20(ctx, sessionID, 1, npcReq)
	if err != nil || npc.BalanceBefore != 0 {
		t.Fatal("NPC roll failed", err, npc)
	}
	npcReq = request("")
	npcReq.NPCUID = "goblin-two"
	npc, err = s.RollSessionD20(ctx, sessionID, 1, npcReq)
	if err != nil || npc.BalanceBefore != 0 {
		t.Fatal("same bestiary clones shared a scale", err, npc)
	}
	npcReq = request("")
	npcReq.NPCUID = "missing"
	if _, err = s.RollSessionD20(ctx, sessionID, 1, npcReq); err == nil {
		t.Fatal("unknown NPC rolled")
	}
	npcReq.NPCUID = "goblin-one"
	if _, err = s.RollSessionD20(ctx, sessionID, 10, npcReq); err == nil {
		t.Fatal("player rolled NPC")
	}
	// Concurrent retries of the same request commit precisely one roll.
	if _, err = s.pool.Exec(ctx, `UPDATE dndshare.session_karmic_scale SET balance=0.2 WHERE session_id=$1 AND actor_key=$2`, sessionID, "char:"+hero); err != nil {
		t.Fatal(err)
	}
	req = request(hero)
	var wg sync.WaitGroup
	results := make(chan SessionD20Result, 8)
	failures := make(chan error, 8)
	for range 8 {
		wg.Go(func() { result, err := s.RollSessionD20(ctx, sessionID, 10, req); results <- result; failures <- err })
	}
	wg.Wait()
	close(results)
	close(failures)
	for err := range failures {
		if err != nil {
			t.Fatal(err)
		}
	}
	var first *SessionD20Result
	for result := range results {
		if result.BalanceBefore != 0.2 {
			t.Fatal("fractional balance was lost", result.BalanceBefore)
		}
		if first == nil {
			first = &result
		} else if !reflect.DeepEqual(*first, result) {
			t.Fatal("retry generated new dice")
		}
	}
	var balance float64
	var count int
	if err = s.pool.QueryRow(ctx, `SELECT balance FROM dndshare.session_karmic_scale WHERE session_id=$1 AND actor_key=$2`, sessionID, "char:"+hero).Scan(&balance); err != nil || balance != first.BalanceAfter {
		t.Fatal("retry advanced balance again", err)
	}
	if err = s.pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.session_d20_roll WHERE session_id=$1 AND request_id=$2::uuid`, sessionID, req.RequestID).Scan(&count); err != nil || count != 1 {
		t.Fatal("duplicate receipts", err, count)
	}
	req.Mode = "advantage"
	if _, err = s.RollSessionD20(ctx, sessionID, 10, req); err == nil {
		t.Fatal("changed request reused receipt")
	}
	if err = s.UpdateSessionSetting(ctx, sessionID, "karmicDice.separate", false); err != nil {
		t.Fatal(err)
	}
	scales, err := s.SessionKarmicScales(ctx, sessionID)
	if err != nil || len(scales) != 0 {
		t.Fatal("mode switch did not reset", err, scales)
	}
	shared, err := s.RollSessionD20(ctx, sessionID, 10, request(hero))
	if err != nil {
		t.Fatal(err)
	}
	next, err := s.RollSessionD20(ctx, sessionID, 20, request(other))
	if err != nil || next.BalanceBefore != shared.BalanceAfter {
		t.Fatal("players did not share scale", err)
	}
	if err = s.UpdateSessionSetting(ctx, sessionID, "karmicDice.enabled", false); err != nil {
		t.Fatal(err)
	}
	scales, err = s.SessionKarmicScales(ctx, sessionID)
	if err != nil || len(scales) != 0 {
		t.Fatal("disable did not reset", err)
	}
}
