package store

import (
	"context"
	"errors"
	"testing"
)

func TestItemCoverOwnership(t *testing.T) {
	pool := currentSchemaTestPool(t)
	seedTestUsers(t, pool, 10, 20)
	seedTestItemTypes(t, pool, 2)
	seedTestImages(t, pool, 456, 789, 321)
	ctx := context.Background()
	var err error
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO dndshare.svg_storage(id,data) VALUES(123,'<svg/>');
 INSERT INTO dndshare.item(id,user_id,custom_source_id,name,type_id,data,icon_svg_id,icon_image_id,cover_image_id) VALUES
 (1,10,(SELECT id FROM dndshare.custom_item_source WHERE user_id=10 AND is_default),'Raster',2,'{}',NULL,456,789),
 (2,NULL,NULL,'System',2,'{}',NULL,321,NULL),
 (3,10,(SELECT id FROM dndshare.custom_item_source WHERE user_id=10 AND is_default),'SVG',2,'{}',123,NULL,789);`)
	s := &Store{pool: pool}
	if _, _, err := s.SetItemCoverImage(ctx, 1, 20, false, "bad", "bad", "bad", "image/png", 1); !errors.Is(err, ErrNotFound) {
		t.Fatalf("non-owner could change cover: %v", err)
	}
	id, refs, err := s.SetItemCoverImage(ctx, 1, 10, false, "cover", "/cover", "cover.jpg", "image/jpeg", 12)
	if err != nil || refs.CoverImageID == nil || *refs.CoverImageID != 789 || refs.ImageID != nil || refs.SVGID != nil {
		t.Fatalf("wrong replaced refs: %+v %v", refs, err)
	}
	var owner int64
	if err := pool.QueryRow(ctx, `SELECT user_id FROM dndshare.storage_image WHERE id=$1`, id).Scan(&owner); err != nil || owner != 10 {
		t.Fatal("cover must belong to item owner")
	}
	if _, err := s.ClearItemCover(ctx, 1, 20, false); !errors.Is(err, ErrNotFound) {
		t.Fatal("non-owner could clear cover")
	}
	refs, err = s.ClearItemCover(ctx, 1, 10, false)
	if err != nil || refs.CoverImageID == nil || *refs.CoverImageID != id {
		t.Fatalf("wrong cleared cover: %+v %v", refs, err)
	}
	var svg *int64
	var icon int64
	var cover *int64
	var same bool
	if err := pool.QueryRow(ctx, `SELECT icon_svg_id,icon_image_id,cover_image_id FROM dndshare.item WHERE id=1`).Scan(&svg, &icon, &cover); err != nil || svg != nil || icon != 456 || cover != nil {
		t.Fatal("cover edit must preserve icon")
	}
	if _, _, err := s.SetItemCoverImage(ctx, 3, 10, false, "svg-cover", "/svg-cover", "cover.webp", "image/webp", 12); err != nil {
		t.Fatal(err)
	}
	var raster *int64
	if err := pool.QueryRow(ctx, `SELECT icon_svg_id,icon_image_id FROM dndshare.item WHERE id=3`).Scan(&svg, &raster); err != nil || svg == nil || *svg != 123 || raster != nil {
		t.Fatal("cover edit must preserve an SVG icon", err)
	}
	if _, _, err = s.SetItemCoverImage(ctx, 2, 10, false, "system", "/system", "cover.png", "image/png", 10); !errors.Is(err, ErrNotFound) {
		t.Fatal("system image requires administrator")
	}
	id, _, err = s.SetItemCoverImage(ctx, 2, 20, true, "system", "/system", "cover.png", "image/png", 10)
	if err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT user_id IS NULL FROM dndshare.storage_image WHERE id=$1`, id).Scan(&same); err != nil || !same {
		t.Fatal("system image must stay system-owned")
	}
}
