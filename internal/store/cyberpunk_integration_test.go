package store

import (
	"dndshare/internal/cyberpunkred"
	"dndshare/internal/testdb"
	"encoding/json"
	"errors"
	"sync"
	"testing"
)

func TestRedCatalogueAndRollPostgres(t *testing.T) {
	ctx := t.Context()
	pool := testdb.Pool(t)
	if err := applySchema(ctx, pool); err != nil {
		t.Fatal(err)
	}
	s := &Store{pool: pool}
	hash := cyberpunkred.CoreHash()
	preview, err := s.InstallRedCatalogue(ctx, hash, false)
	if err != nil || !preview.Preview || preview.Created != 0 {
		t.Fatal(preview, err)
	}
	installed, err := s.InstallRedCatalogue(ctx, hash, true)
	if err != nil {
		t.Fatal(err)
	}
	if installed.Created != preview.Items || installed.Items < 500 {
		t.Fatal(installed)
	}
	again, err := s.InstallRedCatalogue(ctx, hash, true)
	if err != nil || again.Created != 0 {
		t.Fatal(again, err)
	}
	if ok, err := s.CharacterEditionMatchesTemplate(ctx, installed.TemplateID, installed.VersionID); err != nil || !ok {
		t.Fatal(ok, err)
	}
	items, err := s.RedCatalogue(ctx, nil)
	if err != nil || len(items) != installed.Items {
		t.Fatal(len(items), err)
	}
	var statTypeID int64
	if err := pool.QueryRow(ctx, `SELECT id FROM dndshare.suggest_type WHERE source_id=$1 AND name='Характеристики'`, installed.SourceID).Scan(&statTypeID); err != nil {
		t.Fatal(err)
	}
	stat, err := s.FindBaseSuggestByCode(ctx, statTypeID, "INT")
	if err != nil || stat.Desc == nil || *stat.Desc == "INT" {
		t.Fatal("stat description missing from catalogue", stat, err)
	}
	description := "Проверка редактора словаря"
	if err := s.UpdateSuggest(ctx, stat.ID, statTypeID, 0, true, stat.Value, stat.Code, stat.Color, &description, stat.SvgID); err != nil {
		t.Fatal(err)
	}
	if updated, err := s.GetEditableSuggest(ctx, stat.ID, statTypeID, 0, true); err != nil || updated.Desc == nil || *updated.Desc != description {
		t.Fatal("base stat description was not updated", updated, err)
	}
	if _, err = pool.Exec(ctx, `INSERT INTO dndshare.users(id,login,password,source_version_id) VALUES(101,'red-owner','test',$1),(102,'red-other','test',$1)`, installed.VersionID); err != nil {
		t.Fatal(err)
	}
	data := json.RawMessage(`{"system":"cyberpunk-red","schemaVersion":1,"values":{"identity":{"handle":"RED Test"},"stats":{"INT":6,"REF":8,"DEX":6,"TECH":6,"COOL":6,"WILL":6,"LUCK":5,"MOVE":6,"BODY":6,"EMP":6},"health":{"current":40,"deathSavePenalty":0},"humanity":{"current":60},"luck":{"current":5},"skills":[{"uid":"hg","key":"handgun","rank":6}],"roles":[{"uid":"solo","key":"solo","rank":4}],"inventory":{"entries":[{"uid":"gun","key":"weapon-heavy-pistol","equipped":true,"loaded":2}]},"netrunning":{},"cyberware":{"installations":[]}}}`)
	uuid, err := s.CreateCharacter(ctx, 101, installed.TemplateID, &installed.VersionID, nil, data)
	if err != nil {
		t.Fatal(err)
	}
	char, err := s.GetCharacter(ctx, uuid)
	if err != nil {
		t.Fatal(err)
	}
	request := cyberpunkred.RollRequest{Version: char.Version, ActionID: "de000001-0000-4000-8000-000000000001", Kind: "attack", EntryUID: "gun", Title: "Пистолет", Luck: 1}
	if _, err = s.RollRedCharacter(ctx, 102, char.ID, request); !errors.Is(err, ErrNotFound) {
		t.Fatal("other owner", err)
	}
	var wg sync.WaitGroup
	results := make(chan RedRollReceipt, 6)
	errs := make(chan error, 6)
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, e := s.RollRedCharacter(ctx, 101, char.ID, request)
			results <- r
			errs <- e
		}()
	}
	wg.Wait()
	close(results)
	close(errs)
	for e := range errs {
		if e != nil {
			t.Fatal(e)
		}
	}
	var total *int
	for r := range results {
		if r.Version != char.Version+1 || r.Roll.LuckSpent != 1 || r.Roll.AmmoSpent != 1 {
			t.Fatal(r)
		}
		if total == nil {
			n := r.Roll.Total
			total = &n
		} else if r.Roll.Total != *total {
			t.Fatal("retry rerolled dice")
		}
	}
	var ammo, luck, changes int
	if err = pool.QueryRow(ctx, `SELECT (data#>>'{values,inventory,entries,0,loaded}')::int,(data#>>'{values,luck,current}')::int FROM dndshare."char" WHERE id=$1`, char.ID).Scan(&ammo, &luck); err != nil {
		t.Fatal(err)
	}
	if err = pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.character_change WHERE char_id=$1 AND mutation_id=$2::uuid`, char.ID, request.ActionID).Scan(&changes); err != nil {
		t.Fatal(err)
	}
	if ammo != 1 || luck != 4 || changes != 1 {
		t.Fatal(ammo, luck, changes)
	}
	request.Luck = 2
	if _, err = s.RollRedCharacter(ctx, 101, char.ID, request); !errors.Is(err, ErrItemTransferConflict) {
		t.Fatal("different retry accepted", err)
	}
	request.ActionID = "de000001-0000-4000-8000-000000000002"
	if _, err = s.RollRedCharacter(ctx, 101, char.ID, request); !errors.Is(err, ErrCharacterVersion) {
		t.Fatal("stale version accepted", err)
	}
}
