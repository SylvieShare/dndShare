package store

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"sync"
	"testing"
)

func testPotionApplications(t *testing.T, s *Store, exec func(string), current func(int64) transferCharacter) {
	t.Helper()
	ctx := context.Background()
	exec(`INSERT INTO dndshare.item(id,name,type_id,data) VALUES
 (84,'Лечение',10,'{"usable":{"healing":"2d4 + 2"}}'),
 (100,'Эффект',15,'{"stacking":"single","concentration":true,"application_sources":[{"item":101},{"item":102}],"duration":{"kind":"minutes","value":1}}'),
 (101,'Заклинание',5,'{"status_effects":[{"key":"buff","effect":{"id":100}}]}'),
 (102,'Зелье эффекта',10,'{"usable":{"spell":{"id":101},"duration":{"kind":"hours","formula":"1d4"},"concentration":false}}');
 UPDATE dndshare."char" SET data='{"values":{"name":"Тест","hp":{"current":0,"max":{"base":10,"bonuses":[]},"ds_failure":2},"potions":[{"uid":"heal","item_id":84,"count":3},{"uid":"effect","item_id":102,"count":2}]}}' WHERE id=1;
 UPDATE dndshare."char" SET data='{"values":{"hp":{"current":1,"max":{"base":2,"bonuses":[]}},"states":[{"uid":"existing-concentration","effect_id":999,"concentration":true}]}}' WHERE id=2;`)
	version := current(1).Version
	id := "00000000-0000-4000-8000-000000009000"
	var wg sync.WaitGroup
	results := make(chan ApplicationResult, 2)
	errs := make(chan error, 2)
	for range 2 {
		wg.Go(func() { r, e := s.UseItemSelf(ctx, 1, 1, version, "heal", id, "", "potions"); results <- r; errs <- e })
	}
	wg.Wait()
	close(results)
	close(errs)
	for e := range errs {
		if e != nil {
			t.Fatal(e)
		}
	}
	first := <-results
	second := <-results
	if !reflect.DeepEqual(first, second) || first.Healing.Applied < 4 || first.Healing.Applied > 10 {
		t.Fatal(first, second)
	}
	if current(1).Version != version+1 {
		t.Fatal("self use duplicated")
	}
	if _, err := s.UseItemSelf(ctx, 2, 1, version, "heal", id, "", "potions"); !errors.Is(err, ErrNotFound) {
		t.Fatal(err)
	}
	if _, err := s.UseItemSelf(ctx, 1, 1, version, "effect", id, "", "potions"); !errors.Is(err, ErrItemTransferConflict) {
		t.Fatal(err)
	}
	offer, err := s.CreatePotionUse(ctx, 1, 1, 1, 2, current(1).Version, "effect", "00000000-0000-4000-8000-000000009001")
	if err != nil {
		t.Fatal(err)
	}
	sources, e := s.FindItemEffectSources(ctx, nil, 100, 50, 0)
	if e != nil || len(sources) != 2 {
		t.Fatal("spell and potion effect sources", sources, e)
	}
	// Changing the live spell cannot change an already accepted offer's contract.
	exec(`UPDATE dndshare.item SET data='{}' WHERE id=101`)
	accepted, err := s.ResolveItemTransfer(ctx, 2, 2, offer.ID, true)
	if err != nil {
		t.Fatal(err)
	}
	before := current(2)
	retry, err := s.ResolveItemTransfer(ctx, 2, 2, offer.ID, true)
	if err != nil || string(retry.ApplicationResult) != string(accepted.ApplicationResult) || current(2).Version != before.Version {
		t.Fatal("acceptance rerolled", err)
	}
	var result ApplicationResult
	json.Unmarshal(accepted.ApplicationResult, &result)
	if len(result.Effects) != 1 || result.Effects[0].Concentration || result.Effects[0].Duration["kind"] != "hours" {
		t.Fatal(result)
	}
	doc, _ := decodeTransferDocument(before.Data)
	if len(array(doc.values()["states"])) != 2 {
		t.Fatal("potion replaced unrelated concentration", doc)
	}
	healOffer, err := s.CreatePotionUse(ctx, 1, 1, 1, 2, current(1).Version, "heal", "00000000-0000-4000-8000-000000009002")
	if err != nil {
		t.Fatal(err)
	}
	accepted, err = s.ResolveItemTransfer(ctx, 2, 2, healOffer.ID, true)
	if err != nil {
		t.Fatal(err)
	}
	json.Unmarshal(accepted.ApplicationResult, &result)
	if result.Healing.Applied != 1 {
		t.Fatal("recipient cap ignored", result)
	}
	exec(`INSERT INTO dndshare.item(id,name,type_id,data) VALUES
 (103,'Выбор',10,'{"usable":{"choices":[{"key":"healing","healing":"10"}]}}'),
 (104,'Бонус хитов',7,'{"hp_bonuses":[{"base":3,"per_level":1}]}');
 UPDATE dndshare."char" SET data=jsonb_set(data,'{values,potions}',(data#>'{values,potions}') || '[{"uid":"choice","item_id":103,"count":2}]') WHERE id=1;`)
	version = current(1).Version
	if _, err := s.UseItemSelf(ctx, 1, 1, version, "choice", "00000000-0000-4000-8000-000000009003", "", "potions"); !errors.Is(err, ErrApplication) {
		t.Fatal("missing choice accepted", err)
	}
	if current(1).Version != version {
		t.Fatal("invalid choice consumed a dose")
	}
	exec(`UPDATE dndshare."char" SET data=data || '{"values":{"name":"Бонус","lvl":{"level":5},"hp":{"current":9,"max":{"base":10,"bonuses":[]}},"abilities_feats":[{"id":104}],"potions":[{"uid":"choice","item_id":103,"count":1}]}}'::jsonb WHERE id=1;`)
	r, err := s.UseItemSelf(ctx, 1, 1, version, "choice", "00000000-0000-4000-8000-000000009003", "healing", "potions")
	if err != nil || r.Healing.Applied != 9 {
		t.Fatal("derived maximum", r, err)
	}
	exec(`UPDATE dndshare.item SET user_id=3 WHERE id=84;
 UPDATE dndshare."char" SET data=jsonb_set(data,'{values,potions}','[{"uid":"private","item_id":84,"count":1}]') WHERE id=1;`)
	if _, err := s.UseItemSelf(ctx, 1, 1, current(1).Version, "private", "00000000-0000-4000-8000-000000009005", "", "potions"); !errors.Is(err, ErrNotFound) {
		t.Fatal("private catalogue exposed", err)
	}
	if _, err := s.UseItemSelf(ctx, 1, 2, current(2).Version, "choice", "00000000-0000-4000-8000-000000009004", "", "potions"); !errors.Is(err, ErrNotFound) {
		t.Fatal("non-owner", err)
	}

}
