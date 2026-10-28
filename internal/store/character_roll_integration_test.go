package store

import (
	"dndshare/internal/documentpatch"
	"encoding/json"
	"errors"
	"sync"
	"testing"
)

func testAtomicCharacterRoll(t *testing.T, f transferFixture) {
	ctx := t.Context()
	if _, err := f.pool.Exec(ctx, `UPDATE dndshare."char" SET data='{"values":{"name":"Герой","uses":2,"states":[]}}' WHERE id=1;
UPDATE dndshare."session" SET settings='{"karmicDice":{"enabled":true,"separate":true}}' WHERE id=1`); err != nil {
		t.Fatal(err)
	}
	original := f.current(t, 1)
	var session, actor string
	if err := f.pool.QueryRow(ctx, `SELECT uuid::text FROM dndshare."session" WHERE id=1`).Scan(&session); err != nil {
		t.Fatal(err)
	}
	if err := f.pool.QueryRow(ctx, `SELECT uuid::text FROM dndshare."char" WHERE id=1`).Scan(&actor); err != nil {
		t.Fatal(err)
	}
	r := CharacterRollRequest{Version: original.Version, ClientActionID: "99200000-0000-4000-8000-000000000001", SessionUUID: session,
		Prepared: PreparedCharacterD20{Request: CharacterRollSpec{Title: "Проверка", Kind: "ability_check"}, Mode: "advantage", Flat: 3, BonusDice: []int{1}, BonusTotal: 1, BonusExpression: "1d4", MinimumRule: map[string]any{"value": 20}, BonusParts: []map[string]any{{"kind": "dice", "sides": 4, "n": 1, "rolls": []int{1}, "sum": 1}}},
		Patches:  []documentpatch.Operation{{Op: "set", Path: []any{"values", "uses"}, Value: json.RawMessage(`1`)}}, Before: []CharacterRollPrecondition{{Path: []any{"values", "uses"}, Exists: true, Value: json.RawMessage(`2`)}}}
	if _, err := f.store.RollCharacter(ctx, 2, 1, r); !errors.Is(err, ErrNotFound) {
		t.Fatal("nonowner", err)
	}
	var wg sync.WaitGroup
	results := make(chan CharacterRollResult, 8)
	errs := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			reply, err := f.store.RollCharacter(ctx, 1, 1, r)
			results <- reply
			errs <- err
		}()
	}
	wg.Wait()
	close(results)
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	var first CharacterRollResult
	for result := range results {
		if first.EventID == 0 {
			first = result
		}
		if result.EventID != first.EventID || result.Version != original.Version+1 || number(result.Roll["total"]) != 24 {
			t.Fatal("different replay", result, first)
		}
	}
	check := func() (int, int64, int, float64) {
		t.Helper()
		var uses, count int
		var version int64
		var balance float64
		if err := f.pool.QueryRow(ctx, `SELECT (data#>>'{values,uses}')::int,version FROM dndshare."char" WHERE id=1`).Scan(&uses, &version); err != nil {
			t.Fatal(err)
		}
		if err := f.pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.session_event WHERE session_id=1 AND event_type='dice_roll'`).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if err := f.pool.QueryRow(ctx, `SELECT balance FROM dndshare.session_karmic_scale WHERE session_id=1 AND actor_key=$1`, "char:"+actor).Scan(&balance); err != nil {
			t.Fatal(err)
		}
		return uses, version, count, balance
	}
	uses, version, count, balance := check()
	if uses != 1 || version != original.Version+1 || count != 1 {
		t.Fatal("not atomic", uses, version, count)
	}
	if balance != karmicNextBalance(0, number(first.Roll["selected"]), "advantage") {
		t.Fatal("karmic balance applied twice", balance, first)
	}
	changed := r
	changed.Prepared.Flat = 4
	if _, err := f.store.RollCharacter(ctx, 1, 1, changed); !errors.Is(err, ErrItemTransferConflict) {
		t.Fatal("id reuse", err)
	}
	stale := r
	stale.ClientActionID = "99200000-0000-4000-8000-000000000002"
	if _, err := f.store.RollCharacter(ctx, 1, 1, stale); !errors.Is(err, ErrCharacterVersion) {
		t.Fatal("stale version", err)
	}
	stale.Version = version
	if _, err := f.store.RollCharacter(ctx, 1, 1, stale); !errors.Is(err, ErrCharacterVersion) {
		t.Fatal("stale resource", err)
	}
	missing := stale
	missing.Before = append([]CharacterRollPrecondition{}, stale.Before...)
	missing.SessionUUID = "99999999-9999-4999-8999-999999999999"
	missing.Before[0].Value = json.RawMessage(`1`)
	if _, err := f.store.RollCharacter(ctx, 1, 1, missing); !errors.Is(err, ErrNotFound) {
		t.Fatal("missing session", err)
	}
	// Fail after both the d20 and chronicle INSERT: every prior write must roll back.
	if _, err := f.pool.Exec(ctx, `CREATE FUNCTION dndshare.reject_dice_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.mutation_id='99200000-0000-4000-8000-000000000003'::uuid THEN RAISE EXCEPTION 'test receipt failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER reject_dice_receipt BEFORE INSERT ON dndshare.character_change FOR EACH ROW EXECUTE FUNCTION dndshare.reject_dice_receipt()`); err != nil {
		t.Fatal(err)
	}
	failed := missing
	failed.SessionUUID = session
	failed.ClientActionID = "99200000-0000-4000-8000-000000000003"
	if _, err := f.store.RollCharacter(ctx, 1, 1, failed); err == nil {
		t.Fatal("failure not injected")
	}
	u, v, c, b := check()
	if u != uses || v != version || c != count || b != balance {
		t.Fatal("partial rollback", u, v, c, b, uses, version, count, balance)
	}
	testCharacterWeaponUseRoll(t, f, session)
	// Receipt still works after later mutations and session removal; it is the original result.
	if _, err := f.pool.Exec(ctx, `UPDATE dndshare."session" SET deleted=true WHERE id=1`); err != nil {
		t.Fatal(err)
	}
	if replay, err := f.store.RollCharacter(ctx, 1, 1, r); err != nil || replay.EventID != first.EventID {
		t.Fatal("lost response after session closed", replay, err)
	}
}

func testCharacterWeaponUseRoll(t *testing.T, f transferFixture, session string) {
	t.Helper()
	ctx := t.Context()
	if _, err := f.pool.Exec(ctx, `UPDATE dndshare."char" SET data=jsonb_set(data,'{values,weapon}','[{"uid":"staff","item_id":1,"params":{"magic":{"remaining":2}}}]') WHERE id=1`); err != nil {
		t.Fatal(err)
	}
	path := []any{"values", "weapon", map[string]any{"idField": "uid", "id": "staff"}, "params", "magic", "remaining"}
	makeRequest := func(id string, available int) CharacterRollRequest {
		return CharacterRollRequest{Version: f.current(t, 1).Version, ClientActionID: id, SessionUUID: session,
			Prepared: PreparedCharacterD20{Request: CharacterRollSpec{Title: "Разряд", Kind: "attack", TargetUID: "staff", EventData: map[string]any{"weaponUseId": "use-one"}}, Mode: "normal", Flat: 3, MinimumRule: map[string]any{"value": 20}},
			Patches:  []documentpatch.Operation{{Op: "set", Path: path, Value: rawCharacterJSON(available - 1)}}, Before: []CharacterRollPrecondition{{Path: path, Exists: true, Value: rawCharacterJSON(available)}}}
	}
	read := func() (map[string]any, int) {
		t.Helper()
		doc, err := decodeTransferDocument(f.current(t, 1).Data)
		if err != nil {
			t.Fatal(err)
		}
		entry := object(array(doc.values()["weapon"])[0])
		magic := object(object(entry["params"])["magic"])
		return object(magic["weapon_use"]), number(magic["remaining"])
	}
	start := makeRequest("99200000-0000-4000-8000-000000000004", 2)
	start.WeaponUse = &CharacterRollWeaponUse{UID: "staff", Start: map[string]any{"id": "use-one", "status": "active", "steps": []any{map[string]any{"key": "line", "status": "pending", "custom": "keep"}}}}
	first, err := f.store.RollCharacter(ctx, 1, 1, start)
	if err != nil {
		t.Fatal(err)
	}
	state, stock := read()
	if stock != 1 || number(object(state["attack_result"])["total"]) != number(first.Roll["total"]) {
		t.Fatal("start snapshot", state, stock, first)
	}
	if replay, err := f.store.RollCharacter(ctx, 1, 1, start); err != nil || replay.EventID != first.EventID {
		t.Fatal("start replay", replay, err)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE dndshare."char" SET data=jsonb_set(data,'{values,weapon,0,params,magic,weapon_use,steps,0,status}','"rolled"'),version=version+1 WHERE id=1`); err != nil {
		t.Fatal(err)
	}
	reroll := makeRequest("99200000-0000-4000-8000-000000000005", 1)
	reroll.WeaponUse = &CharacterRollWeaponUse{UID: "staff", ID: "use-one"}
	second, err := f.store.RollCharacter(ctx, 1, 1, reroll)
	if err != nil {
		t.Fatal(err)
	}
	state, stock = read()
	step := object(array(state["steps"])[0])
	if stock != 0 || step["status"] != "rolled" || step["custom"] != "keep" || number(object(state["attack_result"])["total"]) != number(second.Roll["total"]) {
		t.Fatal("reroll damaged progress", state, stock, second)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE dndshare."char" SET data=jsonb_set(data,'{values,weapon,0,params,magic,weapon_use,status}','"completed"'),version=version+1 WHERE id=1`); err != nil {
		t.Fatal(err)
	}
	finished := makeRequest("99200000-0000-4000-8000-000000000006", 0)
	finished.Patches[0].Value = rawCharacterJSON(0)
	finished.WeaponUse = &CharacterRollWeaponUse{UID: "staff", ID: "use-one"}
	version := f.current(t, 1).Version
	if _, err := f.store.RollCharacter(ctx, 1, 1, finished); !errors.Is(err, ErrCharacterVersion) {
		t.Fatal("completed use rerolled", err)
	}
	if current := f.current(t, 1); current.Version != version {
		t.Fatal("rejected reroll changed the sheet")
	}
}
