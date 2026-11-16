package store

import (
	"dndshare/internal/testdb"
	"errors"
	"testing"
)

func TestDictionaryMediaPostgres(t *testing.T) {
	ctx := t.Context()
	pool := testdb.Pool(t)
	if err := applySchema(ctx, pool); err != nil {
		t.Fatal(err)
	}
	_, err := pool.Exec(ctx, `INSERT INTO dndshare.source(id,name) VALUES(3,'Cyberpunk');
 INSERT INTO dndshare.suggest_type(id,name,source_id) VALUES(34,'Характеристики',3),(35,'Роли',3);
 INSERT INTO dndshare.suggest(type_id,id,value,code) VALUES(34,1,'Интеллект','INT'),(35,1,'Соло','solo')`)
	if err != nil {
		t.Fatal(err)
	}
	s := &Store{pool: pool}
	icon, _, err := s.SetSystemSuggestImage(ctx, 34, 1, "icon", "system-item-media/int-icon", "/int.webp", "int.webp", "image/webp", 100)
	if err != nil {
		t.Fatal(err)
	}
	cover, _, err := s.SetSystemSuggestImage(ctx, 34, 1, "cover", "system-item-media/int-cover", "/int.jpg", "int.jpg", "image/jpeg", 200)
	if err != nil {
		t.Fatal(err)
	}
	again, old, err := s.SetSystemSuggestImage(ctx, 34, 1, "cover", "system-item-media/int-cover", "/int.jpg", "int.jpg", "image/jpeg", 200)
	if err != nil || again != cover || old == nil || *old != cover {
		t.Fatal(again, old, err)
	}
	row, err := s.GetEditableSuggest(ctx, 1, 34, 0, true)
	if err != nil || row.IconImageID == nil || *row.IconImageID != icon || row.CoverImageID == nil || *row.CoverImageID != cover || row.CoverImageURL == nil {
		t.Fatal(row, err)
	}
	other, err := s.GetEditableSuggest(ctx, 1, 35, 0, true)
	if err != nil || other.CoverImageID != nil || other.IconImageID != nil {
		t.Fatal(other, err)
	}
	typeIcon, _, err := s.SetSystemSuggestTypeImage(ctx, 34, "icon", "system-item-media/stats-icon", "/stats.webp", "stats.webp", "image/webp", 100)
	if err != nil {
		t.Fatal(err)
	}
	typeCover, _, err := s.SetSystemSuggestTypeImage(ctx, 34, "cover", "system-item-media/stats-cover", "/stats.jpg", "stats.jpg", "image/jpeg", 200)
	if err != nil {
		t.Fatal(err)
	}
	sourceID := int64(3)
	types, err := s.GetAllSuggestTypes(ctx, &sourceID)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, typ := range types {
		if typ.ID == 34 {
			found = typ.IconImageID != nil && *typ.IconImageID == typeIcon && typ.CoverImageID != nil && *typ.CoverImageID == typeCover && typ.CoverImageURL != nil
		}
	}
	if !found {
		t.Fatal(types)
	}
	for _, id := range []int64{icon, cover, typeIcon, typeCover} {
		if key, err := s.MarkStorageImageDeletedIfUnreferenced(ctx, id); err != nil || key != nil {
			t.Fatal("referenced dictionary media deleted", id, key, err)
		}
	}
	if _, _, err = s.SetSystemSuggestTypeImage(ctx, 999, "cover", "unused", "/unused", "unused", "image/jpeg", 1); !errors.Is(err, ErrNotFound) {
		t.Fatal(err)
	}
	if _, _, err = s.SetSystemSuggestImage(ctx, 34, 1, "not-a-column", "unused", "unused", "unused", "unused", 1); err == nil {
		t.Fatal("untrusted slot accepted")
	}
}
