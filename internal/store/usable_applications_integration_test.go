package store

import (
	"context"
	"errors"
	"testing"
)

func testUsableApplications(t *testing.T, s *Store, exec func(string), current func(int64) transferCharacter) {
	ctx := context.Background()
	exec(`INSERT INTO dndshare.item(id,name,type_id,data) VALUES
 (90001,'Ягода',2,'{"usable":{"healing":"1"}}'),
 (90002,'Обычная вещь',2,'{}');
 UPDATE dndshare."char" SET data='{"values":{"name":"Проверка ягод","hp":{"current":1,"max":{"base":10}},"items":{"equipped":[{"uid":"berry-equipped","item_id":90001,"count":2}],"sections":[{"id":"bag","items":[{"uid":"berry","item_id":90001,"count":3},{"uid":"ordinary","item_id":90002}]}]}}}' WHERE id=1;
 UPDATE dndshare."char" SET data='{"values":{"name":"Получатель","hp":{"current":1,"max":{"base":10}}}}' WHERE id=2;
 UPDATE dndshare."session" SET settings='{"interactions":{"items":true,"potions":true,"spells":true}}' WHERE id=1;`)
	version := current(1).Version
	action := "00000000-0000-4000-8000-000000090001"
	result, err := s.UseItemSelf(ctx, 1, 1, version, "berry", action, "", "items")
	if err != nil || result.Healing == nil || result.Healing.Applied != 1 {
		t.Fatal("usable backpack item", result, err)
	}
	if _, err = s.UseItemSelf(ctx, 1, 1, version, "berry", action, "", "items"); err != nil || current(1).Version != version+1 {
		t.Fatal("retry spent another berry", err)
	}
	if _, err = s.UseItemSelf(ctx, 1, 1, version, "berry", action, "", "potions"); !errors.Is(err, ErrItemTransferConflict) {
		t.Fatal("receipt accepted another inventory source", err)
	}
	version = current(1).Version
	if _, err = s.UseItemSelf(ctx, 1, 1, version, "ordinary", "00000000-0000-4000-8000-000000090002", "", "items"); !errors.Is(err, ErrApplication) || current(1).Version != version {
		t.Fatal("non-usable item consumed", err)
	}
	offer, err := s.createItemTransfer(ctx, 1, 1, 1, 2, current(1).Version, "items", "berry-equipped", "00000000-0000-4000-8000-000000090003", "use", "")
	if err != nil {
		t.Fatal("reserve equipped usable", err)
	}
	if _, err = s.ResolveItemTransfer(ctx, 2, 2, offer.ID, false); err != nil {
		t.Fatal(err)
	}
	doc, _ := decodeTransferDocument(current(1).Data)
	stack := object(array(object(doc.values()["items"])["equipped"])[0])
	if number(stack["count"]) != 2 {
		t.Fatal("decline lost equipped dose", stack)
	}
	offer, err = s.createItemTransfer(ctx, 1, 1, 1, 2, current(1).Version, "items", "berry", "00000000-0000-4000-8000-000000090004", "use", "")
	if err != nil {
		t.Fatal(err)
	}
	exec(`UPDATE dndshare.item SET data='{"usable":{"healing":"99"}}' WHERE id=90001`)
	accepted, err := s.ResolveItemTransfer(ctx, 2, 2, offer.ID, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(accepted.ApplicationResult) == 0 {
		t.Fatal("missing use result")
	}
	doc, _ = decodeTransferDocument(current(2).Data)
	if number(object(doc.values()["hp"])["current"]) != 2 {
		t.Fatal("pending use followed changed catalogue", doc)
	}
	exec(`INSERT INTO dndshare.item(id,name,type_id,data) VALUES
 (90031,'Эффект попадания',15,'{}'),(90032,'Эффект применения',15,'{}'),
 (90030,'Магическое оружие',19,'{"status_effects":[{"key":"hit","effect":{"id":90031}}],"usable":{"healing":"2","status_effects":[{"key":"consume","effect":{"id":90032}}]}}');`)
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	hit, err := buildCatalogueApplication(ctx, tx, map[string]any{"item_id": 90030}, "hit", 1, 19)
	if err != nil || len(hit.Effects) != 1 || hit.Effects[0].ID != 90031 || hit.Healing != "" {
		t.Fatal("weapon hit mixed with consumable application", hit, err)
	}
	use, err := buildUsableApplication(ctx, tx, map[string]any{"item_id": 90030}, "", 1)
	if err != nil || len(use.Effects) != 1 || use.Effects[0].ID != 90032 || use.Healing != "2" {
		t.Fatal("usable application mixed with weapon hit", use, err)
	}
}
